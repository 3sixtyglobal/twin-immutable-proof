// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	HealthCategory,
	HealthStatus,
	type HealthApplicationCallback,
	type IHealth,
	type IHealthProviderComponent,
	type IPlatformComponent
} from "@twin.org/api-models";
import {
	TaskStatus,
	type IBackgroundTask,
	type IBackgroundTaskComponent,
	type ITaskSchedulerComponent
} from "@twin.org/background-task-models";
import { ContextIdHelper, ContextIdKeys, ContextIdStore } from "@twin.org/context";
import {
	BaseError,
	ComponentFactory,
	Factory,
	GeneralError,
	Guards,
	Is,
	JsonHelper,
	NotFoundError,
	ObjectHelper,
	RandomHelper,
	Urn,
	Validation,
	type IValidationFailure
} from "@twin.org/core";
import { IntegrityAlgorithm, IntegrityHelper } from "@twin.org/crypto";
import { JsonLdHelper, JsonLdProcessor, type IJsonLdNodeObject } from "@twin.org/data-json-ld";
import {
	ComparisonOperator,
	LogicalOperator,
	SortDirection,
	type EntityCondition
} from "@twin.org/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import { IdentityConnectorFactory, type IIdentityConnector } from "@twin.org/identity-models";
import {
	ImmutableProofContexts,
	ImmutableProofFailure,
	ImmutableProofMetricIds,
	ImmutableProofMetrics,
	ImmutableProofSpanAttributes,
	ImmutableProofSpanNames,
	ImmutableProofTopics,
	ImmutableProofTypes,
	type IImmutableProof,
	type IImmutableProofComponent,
	type IImmutableProofCredential,
	type IImmutableProofEventBusProofCreated,
	type IImmutableProofVerification
} from "@twin.org/immutable-proof-models";
import type {
	IImmutableProofTaskPayload,
	IImmutableProofTaskResult
} from "@twin.org/immutable-proof-task";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof, nameofKebabCase } from "@twin.org/nameof";
import {
	NotarizationConnectorFactory,
	NotarizationMode,
	type INotarizationConnector
} from "@twin.org/notarization-models";
import {
	DidContexts,
	DidTypes,
	VerifiableCredentialHelper,
	type IDidVerifiableCredential,
	type IProof
} from "@twin.org/standards-w3c-did";
import { MetricHelper, type ITelemetryComponent } from "@twin.org/telemetry-models";
import { TracingHelper, type ITracingComponent } from "@twin.org/tracing-models";
import type { ImmutableProof } from "./entities/immutableProof.js";
import type { IImmutableProofServiceConfig } from "./models/IImmutableProofServiceConfig.js";
import type { IImmutableProofServiceConstructorOptions } from "./models/IImmutableProofServiceConstructorOptions.js";

/**
 * Class for performing immutable proof operations.
 */
export class ImmutableProofService implements IImmutableProofComponent, IHealthProviderComponent {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<ImmutableProofService>();

	/**
	 * The namespace for the service.
	 * @internal
	 */
	private static readonly _NAMESPACE: string = "immutable-proof";

	/**
	 * The id used to register the reconciliation sweep with the task scheduler component.
	 * @internal
	 */
	private static readonly _SWEEP_SCHEDULED_TASK_ID: string = "immutable-proof-reconciliation";

	/**
	 * The default number of times to retry a proof task when it fails before the notarization phase.
	 * @internal
	 */
	private static readonly _DEFAULT_TASK_RETRY_COUNT: number = 5;

	/**
	 * The default interval in milliseconds to wait between proof task retries.
	 * @internal
	 */
	private static readonly _DEFAULT_TASK_RETRY_INTERVAL: number = 5000;

	/**
	 * The default time in milliseconds to retain the record of a failed proof task, 7 days.
	 * @internal
	 */
	private static readonly _DEFAULT_TASK_FAILURE_RETAIN_FOR: number = 604800000;

	/**
	 * The default interval in minutes at which the reconciliation sweep runs.
	 * @internal
	 */
	private static readonly _DEFAULT_SWEEP_INTERVAL_MINUTES: number = 30;

	/**
	 * The default minimum age in milliseconds before a proof is sweep-eligible, 3 hours.
	 * @internal
	 */
	private static readonly _DEFAULT_SWEEP_STALE_THRESHOLD_MS: number = 10800000;

	/**
	 * The default number of sweep attempts before a proof is parked.
	 * @internal
	 */
	private static readonly _DEFAULT_SWEEP_MAX_ATTEMPTS: number = 5;

	/**
	 * The default maximum number of proofs re-enqueued per tenant per sweep cycle.
	 * @internal
	 */
	private static readonly _DEFAULT_SWEEP_BATCH_LIMIT: number = 10;

	/**
	 * The default minimum time in milliseconds between sweep attempts for the same proof, 1 hour.
	 * @internal
	 */
	private static readonly _DEFAULT_SWEEP_BACKOFF_MS: number = 3600000;

	/**
	 * The configuration for the connector.
	 * @internal
	 */
	private readonly _config: IImmutableProofServiceConfig;

	/**
	 * The logging component.
	 * @internal
	 */
	private readonly _logging?: ILoggingComponent;

	/**
	 * The identity connector.
	 * @internal
	 */
	private readonly _identityConnector: IIdentityConnector;

	/**
	 * The entity storage for proofs.
	 * @internal
	 */
	private readonly _proofStorage: IEntityStorageConnector<ImmutableProof>;

	/**
	 * The notarization connector type.
	 * @internal
	 */
	private readonly _notarizationConnectorType: string;

	/**
	 * The notarization connector for the credentials.
	 * @internal
	 */
	private readonly _notarizationConnector: INotarizationConnector;

	/**
	 * The background task component.
	 * @internal
	 */
	private readonly _backgroundTaskComponent: IBackgroundTaskComponent;

	/**
	 * The event bus component.
	 * @internal
	 */
	private readonly _eventBusComponent?: IEventBusComponent;

	/**
	 * The platform component, used to fan the reconciliation sweep out across every tenant.
	 * @internal
	 */
	private readonly _platformComponent: IPlatformComponent;

	/**
	 * The task scheduler component, used to run the reconciliation sweep on a schedule.
	 * @internal
	 */
	private readonly _taskScheduler: ITaskSchedulerComponent;

	/**
	 * The verification method id to use for the proofs.
	 * @internal
	 */
	private readonly _verificationMethodId: string;

	/**
	 * The identity connector type.
	 * @internal
	 */
	private readonly _identityConnectorType: string;

	/**
	 * The logging component type, passed to the proof task for step logging.
	 * @internal
	 */
	private readonly _loggingComponentType?: string;

	/**
	 * The number of times to retry a proof task when it fails before the notarization phase.
	 * @internal
	 */
	private readonly _taskRetryCount: number;

	/**
	 * The interval in milliseconds to wait between proof task retries.
	 * @internal
	 */
	private readonly _taskRetryInterval: number;

	/**
	 * The time in milliseconds to retain the record of a failed proof task.
	 * @internal
	 */
	private readonly _taskFailureRetainFor: number;

	/**
	 * Whether this instance registered the scheduled sweep, so stop() only removes what
	 * this instance added and a clone can never cancel the main thread's schedule.
	 * @internal
	 */
	private _sweepScheduled: boolean;

	/**
	 * How often, in minutes, the reconciliation sweep runs.
	 * @internal
	 */
	private readonly _sweepIntervalMinutes: number;

	/**
	 * The minimum age in milliseconds before a proof with no notarizationId is sweep-eligible.
	 * @internal
	 */
	private readonly _sweepStaleThresholdMs: number;

	/**
	 * The number of sweep attempts made for a proof before it is parked.
	 * @internal
	 */
	private readonly _sweepMaxAttempts: number;

	/**
	 * The maximum number of proofs the sweep re-enqueues per tenant per cycle.
	 * @internal
	 */
	private readonly _sweepBatchLimit: number;

	/**
	 * The minimum time in milliseconds between sweep attempts for the same proof.
	 * @internal
	 */
	private readonly _sweepBackoffMs: number;

	/**
	 * Proofs created before this date-time with no interpretable task record are treated
	 * as pre-submission failures and re-enqueued instead of parked.
	 * @internal
	 */
	private readonly _sweepAssumeRetryableBefore?: string;

	/**
	 * The optional telemetry component used for event metrics.
	 * @internal
	 */
	private readonly _telemetryComponent?: ITelemetryComponent;

	/**
	 * The optional tracing component for recording spans.
	 * @internal
	 */
	private readonly _tracingComponent?: ITracingComponent;

	/**
	 * Creates an instance of ImmutableProofService.
	 * @param options The dependencies for the immutable proof connector.
	 */
	constructor(options?: IImmutableProofServiceConstructorOptions) {
		this._proofStorage = EntityStorageConnectorFactory.get(
			options?.immutableProofEntityStorageType ?? nameofKebabCase<ImmutableProof>()
		);

		this._notarizationConnectorType = options?.notarizationConnectorType ?? "notarization";
		this._notarizationConnector = NotarizationConnectorFactory.get(this._notarizationConnectorType);

		this._loggingComponentType = options?.loggingComponentType;
		this._logging = ComponentFactory.getIfExists<ILoggingComponent>(options?.loggingComponentType);

		this._identityConnectorType = options?.identityConnectorType ?? "identity";

		this._identityConnector = IdentityConnectorFactory.get(this._identityConnectorType);

		this._backgroundTaskComponent = ComponentFactory.get(
			options?.backgroundTaskComponentType ?? "background-task"
		);

		if (Is.stringValue(options?.eventBusComponentType)) {
			this._eventBusComponent = ComponentFactory.get(options.eventBusComponentType);
		}

		this._platformComponent = ComponentFactory.get<IPlatformComponent>(
			options?.platformComponentType ?? "platform"
		);
		this._taskScheduler = ComponentFactory.get<ITaskSchedulerComponent>(
			options?.taskSchedulerComponentType ?? "task-scheduler"
		);
		this._sweepScheduled = false;

		this._config = options?.config ?? {};

		// Validate the task options at construction, otherwise out of range values only
		// surface as background task component errors on every proof creation.
		const validationErrors: IValidationFailure[] = [];
		if (!Is.undefined(this._config.taskRetryCount)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.taskRetryCount),
				this._config.taskRetryCount
			);
			Validation.integer(
				nameof(this._config.taskRetryCount),
				this._config.taskRetryCount,
				validationErrors,
				undefined,
				{ minValue: 0 }
			);
		}
		if (!Is.undefined(this._config.taskRetryInterval)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.taskRetryInterval),
				this._config.taskRetryInterval
			);
			Validation.integer(
				nameof(this._config.taskRetryInterval),
				this._config.taskRetryInterval,
				validationErrors,
				undefined,
				{ minValue: 1 }
			);
		}
		if (!Is.undefined(this._config.taskFailureRetainFor)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.taskFailureRetainFor),
				this._config.taskFailureRetainFor
			);
			Validation.integer(
				nameof(this._config.taskFailureRetainFor),
				this._config.taskFailureRetainFor,
				validationErrors,
				undefined,
				{ minValue: -1 }
			);
		}
		if (!Is.undefined(this._config.sweepIntervalMinutes)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.sweepIntervalMinutes),
				this._config.sweepIntervalMinutes
			);
			Validation.integer(
				nameof(this._config.sweepIntervalMinutes),
				this._config.sweepIntervalMinutes,
				validationErrors,
				undefined,
				{ minValue: 1 }
			);
		}
		if (!Is.undefined(this._config.sweepStaleThresholdMs)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.sweepStaleThresholdMs),
				this._config.sweepStaleThresholdMs
			);
			Validation.integer(
				nameof(this._config.sweepStaleThresholdMs),
				this._config.sweepStaleThresholdMs,
				validationErrors,
				undefined,
				{ minValue: 60000 }
			);
		}
		if (!Is.undefined(this._config.sweepMaxAttempts)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.sweepMaxAttempts),
				this._config.sweepMaxAttempts
			);
			Validation.integer(
				nameof(this._config.sweepMaxAttempts),
				this._config.sweepMaxAttempts,
				validationErrors,
				undefined,
				{ minValue: 1 }
			);
		}
		if (!Is.undefined(this._config.sweepBatchLimit)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.sweepBatchLimit),
				this._config.sweepBatchLimit
			);
			Validation.integer(
				nameof(this._config.sweepBatchLimit),
				this._config.sweepBatchLimit,
				validationErrors,
				undefined,
				{ minValue: 1 }
			);
		}
		if (!Is.undefined(this._config.sweepBackoffMs)) {
			Guards.integer(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.sweepBackoffMs),
				this._config.sweepBackoffMs
			);
			Validation.integer(
				nameof(this._config.sweepBackoffMs),
				this._config.sweepBackoffMs,
				validationErrors,
				undefined,
				{ minValue: 1 }
			);
		}
		if (!Is.empty(this._config.sweepAssumeRetryableBefore)) {
			Guards.dateTimeString(
				ImmutableProofService.CLASS_NAME,
				nameof(this._config.sweepAssumeRetryableBefore),
				this._config.sweepAssumeRetryableBefore
			);
		}
		Validation.asValidationError(
			ImmutableProofService.CLASS_NAME,
			nameof(this._config),
			validationErrors
		);

		this._verificationMethodId = this._config.verificationMethodId ?? "immutable-proof-assertion";
		this._taskRetryCount =
			this._config.taskRetryCount ?? ImmutableProofService._DEFAULT_TASK_RETRY_COUNT;
		this._taskRetryInterval =
			this._config.taskRetryInterval ?? ImmutableProofService._DEFAULT_TASK_RETRY_INTERVAL;
		this._taskFailureRetainFor =
			this._config.taskFailureRetainFor ?? ImmutableProofService._DEFAULT_TASK_FAILURE_RETAIN_FOR;
		this._sweepIntervalMinutes =
			this._config.sweepIntervalMinutes ?? ImmutableProofService._DEFAULT_SWEEP_INTERVAL_MINUTES;
		this._sweepStaleThresholdMs =
			this._config.sweepStaleThresholdMs ?? ImmutableProofService._DEFAULT_SWEEP_STALE_THRESHOLD_MS;
		this._sweepMaxAttempts =
			this._config.sweepMaxAttempts ?? ImmutableProofService._DEFAULT_SWEEP_MAX_ATTEMPTS;
		this._sweepBatchLimit =
			this._config.sweepBatchLimit ?? ImmutableProofService._DEFAULT_SWEEP_BATCH_LIMIT;
		this._sweepBackoffMs =
			this._config.sweepBackoffMs ?? ImmutableProofService._DEFAULT_SWEEP_BACKOFF_MS;
		this._sweepAssumeRetryableBefore = this._config.sweepAssumeRetryableBefore;

		this._telemetryComponent = ComponentFactory.getIfExists<ITelemetryComponent>(
			options?.telemetryComponentType
		);
		this._tracingComponent = ComponentFactory.getIfExists<ITracingComponent>(
			options?.tracingComponentType
		);
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return ImmutableProofService.CLASS_NAME;
	}

	/**
	 * Runs a full notarization lifecycle (create, get, remove) against the organisation identity
	 * from the current context.
	 * @param callback The callback to invoke with the health status of the service.
	 * @returns The health status of the service.
	 */
	public async healthApplication(
		callback: HealthApplicationCallback
	): Promise<IHealth[] | undefined> {
		const contextIds = (await ContextIdStore.getContextIds()) ?? {};
		const orgId = contextIds[ContextIdKeys.Organization];

		if (!Is.stringValue(orgId)) {
			return [];
		}

		try {
			const notarizationId = await this._notarizationConnector.create(orgId, {
				mode: NotarizationMode.Dynamic,
				data: new Uint8Array([0])
			});
			const info = await this._notarizationConnector.get(notarizationId);
			await this._notarizationConnector.remove(orgId, notarizationId);
			return [
				{
					source: ImmutableProofService.CLASS_NAME,
					category: HealthCategory.Application,
					status: Is.object(info) ? HealthStatus.Ok : HealthStatus.Error,
					description: "healthDescription",
					message: Is.object(info) ? undefined : "getNotarizationFailed",
					data: {
						notarizationId
					}
				}
			];
		} catch (error) {
			return [
				{
					source: ImmutableProofService.CLASS_NAME,
					category: HealthCategory.Application,
					status: HealthStatus.Error,
					description: "healthDescription",
					message: "getNotarizationFailed",
					error: BaseError.fromError(error)
				}
			];
		}
	}

	/**
	 * The component needs to be started when the node is initialized.
	 * @param nodeLoggingComponentType The node logging component type.
	 * @returns A promise that resolves when the background task handler has been registered.
	 */
	public async start(nodeLoggingComponentType?: string): Promise<void> {
		await MetricHelper.createMetrics(this._telemetryComponent, ImmutableProofMetrics);

		await this._backgroundTaskComponent.registerHandler<
			IImmutableProofTaskPayload,
			IImmutableProofTaskResult
		>("immutable-proof", "@twin.org/immutable-proof-task", "processProofTask", async task => {
			await this.finaliseTask(task);
		});

		// Clones (worker threads running a cloned engine, e.g. inside processProofTask) must
		// never register their own copy of the scheduled sweep. Safe today because the clone
		// allow-list doesn't include this component's type, but this guard doesn't depend on
		// that staying true.
		const isCloneOrNoEngine =
			Factory.getFactory<{ isClone: () => boolean }>("engine-core")
				?.getIfExists("engine")
				?.isClone() ?? true;
		if (isCloneOrNoEngine) {
			return;
		}

		await this._taskScheduler.addTask(
			ImmutableProofService._SWEEP_SCHEDULED_TASK_ID,
			[{ nextTriggerTime: Date.now(), intervalMinutes: this._sweepIntervalMinutes }],
			async () => {
				try {
					await this._platformComponent.execute(async () => this.sweepCurrentPartition());
				} catch (error) {
					await this._logging?.log({
						level: "error",
						source: ImmutableProofService.CLASS_NAME,
						ts: Date.now(),
						message: "sweepFailed",
						error: BaseError.fromError(error)
					});
				}
			}
		);
		this._sweepScheduled = true;
	}

	/**
	 * The component needs to be stopped when the node is closed.
	 * @param nodeLoggingComponentType The node logging component type.
	 * @returns A promise that resolves when the scheduled sweep has been removed.
	 */
	public async stop(nodeLoggingComponentType?: string): Promise<void> {
		// Only remove the scheduled sweep if this instance registered it - a clone stopping
		// must not cancel the main thread's schedule.
		if (this._sweepScheduled) {
			await this._taskScheduler.removeTask(ImmutableProofService._SWEEP_SCHEDULED_TASK_ID);
			this._sweepScheduled = false;
		}
	}

	/**
	 * Create a new proof.
	 * @param document The document to create the proof for.
	 * @param options Optional settings for the proof.
	 * @param options.deleteLock An ISO 8601 date-time string specifying when the notarization lock expires; if omitted no lock is applied.
	 * @returns The id of the new proof.
	 */
	public async create(
		document: IJsonLdNodeObject,
		options?: { deleteLock?: string }
	): Promise<string> {
		Guards.object<IJsonLdNodeObject>(ImmutableProofService.CLASS_NAME, nameof(document), document);

		if (!Is.empty(options?.deleteLock)) {
			Guards.dateTimeString(
				ImmutableProofService.CLASS_NAME,
				nameof(options.deleteLock),
				options.deleteLock
			);
		}

		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Organization);

		return TracingHelper.withSpan(
			this._tracingComponent,
			ImmutableProofSpanNames.Create,
			undefined,
			async () => {
				try {
					const validationFailures: IValidationFailure[] = [];
					await JsonLdHelper.validate(document, validationFailures);
					Validation.asValidationError(
						ImmutableProofService.CLASS_NAME,
						nameof(document),
						validationFailures
					);

					const id = RandomHelper.generateUuidV7("compact");

					const dateCreated = new Date(Date.now()).toISOString();

					const proofObjectId = ObjectHelper.extractProperty<string>(
						document,
						["@id", "id"],
						false
					);

					// We don't want to store the whole document in the immutable proof, as this could be large
					// and also reveal information that should not be stored in the proof so we hash the document
					// and store the hash
					const proofObjectIntegrity = IntegrityHelper.generate(
						IntegrityAlgorithm.Sha256,
						ObjectHelper.toBytes(JsonHelper.canonicalize(document))
					);

					const proofEntityBase: ImmutableProof = {
						id,
						organizationId: contextIds[ContextIdKeys.Organization],
						dateCreated,
						proofObjectId,
						proofObjectIntegrity,
						deleteLock: options?.deleteLock
					};

					const proofTaskPayload = this.buildTaskPayload(proofEntityBase);

					// Create the task before persisting the entity. If the entity write below then
					// fails, the task is removed too (see catch), so this ordering avoids relying on
					// the sweep to notice and park an entity that was never enqueued.
					const taskId = await this._backgroundTaskComponent.create(
						"immutable-proof",
						proofTaskPayload,
						this.buildTaskRetryOptions()
					);

					try {
						await this._proofStorage.set({ ...proofEntityBase, taskId });
					} catch (error) {
						// The entity failed to persist after the task was created: best-effort remove
						// the task so it doesn't run for a proof that was never saved.
						try {
							await this._backgroundTaskComponent.remove(taskId);
						} catch (removeError) {
							await this._logging?.log({
								source: ImmutableProofService.CLASS_NAME,
								level: "warn",
								ts: Date.now(),
								message: "orphanedTaskRemoveFailed",
								error: BaseError.fromError(removeError),
								data: { proofId: proofTaskPayload.proofId, taskId }
							});
						}
						throw error;
					}

					await MetricHelper.metricIncrement(
						this._telemetryComponent,
						ImmutableProofMetricIds.ProofsCreated,
						{ hasDeleteLock: Is.stringValue(options?.deleteLock) }
					);

					return proofTaskPayload.proofId;
				} catch (error) {
					throw new GeneralError(
						ImmutableProofService.CLASS_NAME,
						"createFailed",
						undefined,
						error
					);
				}
			}
		);
	}

	/**
	 * Get a proof.
	 * @param id The id of the proof to get.
	 * @returns The proof.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async get(id: string): Promise<IImmutableProofCredential> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);

		this.parseProofId(id);

		return TracingHelper.withSpan(
			this._tracingComponent,
			ImmutableProofSpanNames.Get,
			{ attributes: { [ImmutableProofSpanAttributes.Id]: id } },
			async () => {
				try {
					const { verifiableCredential } = await this.internalGet(id, false);

					const result = await JsonLdProcessor.compact(
						verifiableCredential,
						verifiableCredential["@context"]
					);
					return result;
				} catch (error) {
					throw new GeneralError(ImmutableProofService.CLASS_NAME, "getFailed", undefined, error);
				}
			}
		);
	}

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async verify(id: string): Promise<IImmutableProofVerification> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);

		this.parseProofId(id);

		return TracingHelper.withSpan(
			this._tracingComponent,
			ImmutableProofSpanNames.Verify,
			{ attributes: { [ImmutableProofSpanAttributes.Id]: id } },
			async () => {
				try {
					const { verified, failure } = await this.internalGet(id, true);

					if (verified) {
						await MetricHelper.metricIncrement(
							this._telemetryComponent,
							ImmutableProofMetricIds.VerificationsSucceeded
						);
					} else {
						await MetricHelper.metricIncrement(
							this._telemetryComponent,
							ImmutableProofMetricIds.VerificationsFailed,
							{ failureReason: failure }
						);
					}

					return {
						"@context": ImmutableProofContexts.Context,
						type: ImmutableProofTypes.ImmutableProofVerification,
						verified,
						failure
					};
				} catch (error) {
					throw new GeneralError(
						ImmutableProofService.CLASS_NAME,
						"verifyFailed",
						undefined,
						error
					);
				}
			}
		);
	}

	/**
	 * Remove the proof and its notarization.
	 * @param id The id of the proof to remove.
	 * @returns A promise that resolves when the proof and its notarization have been removed.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async remove(id: string): Promise<void> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);
		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Organization);

		const urnParsed = this.parseProofId(id);

		await TracingHelper.withSpan(
			this._tracingComponent,
			ImmutableProofSpanNames.Remove,
			{ attributes: { [ImmutableProofSpanAttributes.Id]: id } },
			async () => {
				try {
					const proofId = urnParsed.namespaceSpecific(0);
					const proofEntity = await this._proofStorage.get(proofId);

					if (Is.empty(proofEntity)) {
						throw new NotFoundError(ImmutableProofService.CLASS_NAME, "proofNotFound", id);
					}

					if (Is.stringValue(proofEntity.notarizationId)) {
						await this._notarizationConnector.remove(
							contextIds[ContextIdKeys.Organization],
							proofEntity.notarizationId
						);
					}

					await this._proofStorage.remove(proofId);

					await MetricHelper.metricIncrement(
						this._telemetryComponent,
						ImmutableProofMetricIds.ProofsRemoved
					);
				} catch (error) {
					throw new GeneralError(
						ImmutableProofService.CLASS_NAME,
						"removeFailed",
						undefined,
						error
					);
				}
			}
		);
	}

	/**
	 * Remove only the notarization for the proof, keeping the proof entity.
	 * @param id The id of the proof to remove the notarization from.
	 * @returns A promise that resolves when the notarization has been removed.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async removeNotarization(id: string): Promise<void> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);
		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Organization);

		const urnParsed = this.parseProofId(id);

		try {
			const proofId = urnParsed.namespaceSpecific(0);
			const proofEntity = await this._proofStorage.get(proofId);

			if (Is.empty(proofEntity)) {
				throw new NotFoundError(ImmutableProofService.CLASS_NAME, "proofNotFound", id);
			}

			if (Is.stringValue(proofEntity.notarizationId)) {
				await this._notarizationConnector.remove(
					contextIds[ContextIdKeys.Organization],
					proofEntity.notarizationId
				);
				delete proofEntity.notarizationId;
				await this._proofStorage.set(proofEntity);

				await MetricHelper.metricIncrement(
					this._telemetryComponent,
					ImmutableProofMetricIds.NotarizationsRemoved
				);
			}
		} catch (error) {
			throw new GeneralError(
				ImmutableProofService.CLASS_NAME,
				"removeNotarizationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Parse a proof id and check it belongs to this service's namespace.
	 * @param id The proof id (urn) to parse.
	 * @returns The parsed urn.
	 * @throws GeneralError if the urn's namespace does not match this service's namespace.
	 * @internal
	 */
	private parseProofId(id: string): Urn {
		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

		return urnParsed;
	}

	/**
	 * Build the background task payload for a proof entity.
	 * @param proofEntity The proof entity to build the payload for.
	 * @returns The task payload.
	 * @internal
	 */
	private buildTaskPayload(proofEntity: ImmutableProof): IImmutableProofTaskPayload {
		const credentialSubject: IImmutableProof = {
			"@context": [ImmutableProofContexts.Context, ImmutableProofContexts.ContextCommon],
			type: ImmutableProofTypes.ImmutableProof,
			id: proofEntity.proofObjectId,
			proofIntegrity: proofEntity.proofObjectIntegrity
		};

		return {
			proofId: new Urn(ImmutableProofService._NAMESPACE, proofEntity.id).toString(),
			identity: proofEntity.organizationId,
			identityConnectorType: this._identityConnectorType,
			notarizationConnectorType: this._notarizationConnectorType,
			verificationMethodId: this._verificationMethodId,
			credentialSubject,
			deleteLockDateTime: proofEntity.deleteLock,
			loggingComponentType: this._loggingComponentType
		};
	}

	/**
	 * Build the background task creation options shared by initial creation and re-enqueueing.
	 * @returns The task creation options.
	 * @internal
	 */
	private buildTaskRetryOptions(): {
		retryCount: number | undefined;
		retryInterval: number;
		retainFor: number;
	} {
		return {
			// A zero retry count maps to undefined: the task engine only accepts counts >= 1
			// and treats an unspecified count as no retries.
			retryCount: this._taskRetryCount > 0 ? this._taskRetryCount : undefined,
			retryInterval: this._taskRetryInterval,
			retainFor: this._taskFailureRetainFor
		};
	}

	/**
	 * Periodically re-enqueue proofs stuck without a notarization so they self-heal without
	 * operator action, parking any whose failure cannot be proven safe to retry. Assumes the
	 * ambient context already selects the correct node/tenant partition.
	 * @returns A promise that resolves when the sweep cycle for the current partition completes.
	 * @internal
	 */
	private async sweepCurrentPartition(): Promise<void> {
		const staleThreshold = new Date(Date.now() - this._sweepStaleThresholdMs).toISOString();

		let scanned = 0;
		let reEnqueued = 0;
		let skippedInFlight = 0;
		let newlyParked = 0;
		let legacyTaskCache:
			| Map<string, IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>>
			| undefined;
		const getLegacyTaskCache = async (): Promise<
			Map<string, IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>>
		> => {
			legacyTaskCache ??= await this.buildLegacyTaskCache();
			return legacyTaskCache;
		};

		let cursor: string | undefined;
		do {
			const condition: EntityCondition<ImmutableProof> = {
				conditions: [
					{ property: "notarizationId", comparison: ComparisonOperator.Equals, value: undefined },
					{
						property: "dateCreated",
						comparison: ComparisonOperator.LessThan,
						value: staleThreshold
					}
				],
				logicalOperator: LogicalOperator.And
			};

			const page = await this._proofStorage.query(
				condition,
				[{ property: "dateCreated", sortDirection: SortDirection.Ascending }],
				undefined,
				cursor
			);

			for (const proofEntity of page.entities as ImmutableProof[]) {
				if (reEnqueued >= this._sweepBatchLimit) {
					break;
				}

				scanned++;

				const outcome = await this.processSweepCandidate(proofEntity, getLegacyTaskCache);
				if (outcome === "skippedInFlight") {
					skippedInFlight++;
				} else if (outcome === "parked") {
					newlyParked++;
				} else if (outcome === "reEnqueued") {
					reEnqueued++;
				}
			}

			cursor = page.cursor;
		} while (Is.stringValue(cursor) && reEnqueued < this._sweepBatchLimit);

		const totalParked = await this.countParkedProofs();

		await this._logging?.log({
			level: "info",
			source: ImmutableProofService.CLASS_NAME,
			ts: Date.now(),
			message: "sweepCompleted",
			data: { scanned, reEnqueued, skippedInFlight, newlyParked, totalParked }
		});

		if (totalParked > 0) {
			await this._logging?.log({
				level: "warn",
				source: ImmutableProofService.CLASS_NAME,
				ts: Date.now(),
				message: "sweepParkedTotal",
				data: { totalParked }
			});
		}
	}

	/**
	 * Evaluate a single sweep candidate against the guard chain and classification, acting
	 * on it (skip, park, or re-enqueue) as appropriate.
	 * @param proofEntity The candidate proof entity.
	 * @param getLegacyTaskCache Lazily builds, and caches for the current cycle, the task
	 * lookup for proof entities with no taskId.
	 * @returns The outcome of evaluating this candidate.
	 * @internal
	 */
	private async processSweepCandidate(
		proofEntity: ImmutableProof,
		getLegacyTaskCache: () => Promise<
			Map<string, IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>>
		>
	): Promise<"skipped" | "skippedInFlight" | "parked" | "reEnqueued"> {
		// Belt-and-braces: the selection query cannot reliably exclude parked proofs -
		// NotEquals against an absent property returns false under both the shared in-memory
		// matcher and SQL NULL semantics, which would incorrectly exclude every normal proof
		// instead of just parked ones. Filtering here instead is correct and no more expensive,
		// since parked rows still have to be paged past either way.
		if (proofEntity.isParked) {
			return "skipped";
		}

		let task: IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult> | undefined;
		if (Is.stringValue(proofEntity.taskId)) {
			task = await this._backgroundTaskComponent.get<
				IImmutableProofTaskPayload,
				IImmutableProofTaskResult
			>(proofEntity.taskId);
		} else {
			const cache = await getLegacyTaskCache();
			task = cache.get(new Urn(ImmutableProofService._NAMESPACE, proofEntity.id).toString());
		}

		if (
			Is.object(task) &&
			(task.status === TaskStatus.Pending || task.status === TaskStatus.Processing)
		) {
			await this._logging?.log({
				level: "debug",
				source: ImmutableProofService.CLASS_NAME,
				ts: Date.now(),
				message: "sweepSkippedInFlight",
				data: { proofId: proofEntity.id }
			});
			return "skippedInFlight";
		}

		if (Is.stringValue(proofEntity.lastSweepAttempt)) {
			const backoffMs = this._sweepBackoffMs * Math.pow(2, (proofEntity.sweepAttempts ?? 1) - 1);
			const nextEligible =
				new Date(proofEntity.lastSweepAttempt).getTime() + Math.min(backoffMs, 86400000);
			if (nextEligible > Date.now()) {
				return "skipped";
			}
		}

		if (
			(proofEntity.sweepAttempts ?? 0) >= this._sweepMaxAttempts ||
			!this.isRetryable(proofEntity, task)
		) {
			proofEntity.isParked = true;
			await this._proofStorage.set(proofEntity);
			await this._logging?.log({
				level: "warn",
				source: ImmutableProofService.CLASS_NAME,
				ts: Date.now(),
				message: "sweepParked",
				data: { proofId: proofEntity.id, sweepAttempts: proofEntity.sweepAttempts ?? 0 }
			});
			return "parked";
		}

		await this.reEnqueueProof(proofEntity);
		return "reEnqueued";
	}

	/**
	 * Decide whether a proof is safe to re-enqueue given its most recent background task
	 * record. A missing or unclassifiable record parks the proof unless its era is explicitly
	 * authorised via sweepAssumeRetryableBefore.
	 * @param proofEntity The proof entity being evaluated.
	 * @param task The most recent background task for the proof, if one could be found.
	 * @returns True if the proof is safe to re-enqueue.
	 * @internal
	 */
	private isRetryable(
		proofEntity: ImmutableProof,
		task: IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult> | undefined
	): boolean {
		if (Is.object(task)) {
			if (task.status === TaskStatus.Failed) {
				// Thrown errors only occur before the notarization phase, by construction of
				// processProofTask, so a failed task record is always safe to retry.
				return true;
			}
			if (task.status === TaskStatus.Success && Is.object(task.result?.notarizationError)) {
				// The connector collapses pre- and post-submission failures into one error code,
				// so this class is not provably safe unless the era is explicitly authorised.
				return this.isWithinAssumedRetryableEra(proofEntity);
			}
		}

		// No usable task record: either never enqueued (orphan) or the record expired or was
		// removed. Only safe to assume pre-submission for an explicitly authorised era.
		return this.isWithinAssumedRetryableEra(proofEntity);
	}

	/**
	 * Check whether a proof predates the explicitly configured era known to guarantee
	 * pre-submission failures.
	 * @param proofEntity The proof entity being evaluated.
	 * @returns True if sweepAssumeRetryableBefore is set and the proof predates it.
	 * @internal
	 */
	private isWithinAssumedRetryableEra(proofEntity: ImmutableProof): boolean {
		if (!Is.stringValue(this._sweepAssumeRetryableBefore)) {
			return false;
		}
		return (
			new Date(proofEntity.dateCreated).getTime() <
			new Date(this._sweepAssumeRetryableBefore).getTime()
		);
	}

	/**
	 * Rebuild and re-create the background task for a stuck proof, then persist the updated
	 * sweep bookkeeping on its entity.
	 * @param proofEntity The proof entity to re-enqueue.
	 * @returns A promise that resolves when the task has been created and the entity updated.
	 * @internal
	 */
	private async reEnqueueProof(proofEntity: ImmutableProof): Promise<void> {
		const ambientContextIds = (await ContextIdStore.getContextIds()) ?? {};

		// Organization is absent from ambient context in multi-tenant mode, but create()'s
		// payload and downstream guards need it, so inject it from the swept entity itself.
		const taskId = await ContextIdStore.run(
			{ ...ambientContextIds, [ContextIdKeys.Organization]: proofEntity.organizationId },
			async () => {
				const proofTaskPayload = this.buildTaskPayload(proofEntity);
				return this._backgroundTaskComponent.create(
					"immutable-proof",
					proofTaskPayload,
					this.buildTaskRetryOptions()
				);
			}
		);

		proofEntity.taskId = taskId;
		proofEntity.sweepAttempts = (proofEntity.sweepAttempts ?? 0) + 1;
		proofEntity.lastSweepAttempt = new Date(Date.now()).toISOString();

		await this._proofStorage.set(proofEntity);

		await this._logging?.log({
			level: "info",
			source: ImmutableProofService.CLASS_NAME,
			ts: Date.now(),
			message: "sweepReEnqueued",
			data: { proofId: proofEntity.id, taskId }
		});
	}

	/**
	 * Build a cache of the most recent background task for each proof, keyed by proof urn, by
	 * paging through every relevant status for the immutable-proof task type. Only needed for
	 * proof entities written before taskId was persisted. Any superseded task found for a proof
	 * is removed, since the cached, more recent one will provide the eventual result.
	 * @returns A map of proof urn to its most recent background task.
	 * @internal
	 */
	private async buildLegacyTaskCache(): Promise<
		Map<string, IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>>
	> {
		const cache = new Map<
			string,
			IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>
		>();
		const superseded: { taskId: string; proofId: string }[] = [];

		for (const status of [
			TaskStatus.Pending,
			TaskStatus.Processing,
			TaskStatus.Success,
			TaskStatus.Failed
		]) {
			let cursor: string | undefined;
			do {
				const page = await this._backgroundTaskComponent.query(
					"immutable-proof",
					status,
					undefined,
					undefined,
					cursor
				);
				for (const task of page.entities as IBackgroundTask<
					IImmutableProofTaskPayload,
					IImmutableProofTaskResult
				>[]) {
					if (Is.stringValue(task.payload?.proofId)) {
						// Iterating one query per status can surface an older task after a newer
						// one (e.g. a stale Failed record after the sweep already re-enqueued a
						// still-Processing task for the same proof), so keep whichever is
						// actually more recent rather than whichever was seen last.
						const proofId = task.payload.proofId;
						const existing = cache.get(proofId);
						if (
							!existing ||
							new Date(task.dateModified).getTime() > new Date(existing.dateModified).getTime()
						) {
							if (existing) {
								superseded.push({ taskId: existing.id, proofId });
							}
							cache.set(proofId, task);
						} else {
							superseded.push({ taskId: task.id, proofId });
						}
					}
				}
				cursor = page.cursor;
			} while (Is.stringValue(cursor));
		}

		// Removed only once the full cache is built, so an older record is never deleted
		// while a query for another status is still paging through it.
		for (const { taskId, proofId } of superseded) {
			try {
				await this._backgroundTaskComponent.remove(taskId);
			} catch (error) {
				await this._logging?.log({
					source: ImmutableProofService.CLASS_NAME,
					level: "warn",
					ts: Date.now(),
					message: "supersededTaskRemoveFailed",
					error: BaseError.fromError(error),
					data: { proofId, taskId }
				});
			}
		}

		return cache;
	}

	/**
	 * Count the proofs currently parked in the current partition.
	 * @returns The number of parked proofs.
	 * @internal
	 */
	private async countParkedProofs(): Promise<number> {
		return this._proofStorage.count({
			conditions: [{ property: "isParked", comparison: ComparisonOperator.Equals, value: true }]
		});
	}

	/**
	 * Process a proof.
	 * @param task The background task to finalise.
	 * @internal
	 */
	private async finaliseTask(
		task: IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>
	): Promise<void> {
		if (Is.object(task.payload)) {
			if (task.status === TaskStatus.Success && Is.object(task.result)) {
				if (Is.object(task.result.notarizationError)) {
					// The notarization phase failed; the task reports it in the result instead of
					// throwing so the task engine does not retry, as the notarization may already
					// have reached the ledger. The task record is retained so it can be inspected.
					await this._logging?.log({
						source: ImmutableProofService.CLASS_NAME,
						level: "error",
						ts: Date.now(),
						message: "createProofFailed",
						error: BaseError.fromError(task.result.notarizationError),
						data: { proofId: task.payload.proofId }
					});
					return;
				}

				const urnParsed = Urn.fromValidString(task.payload.proofId);
				const proofId = urnParsed.namespaceSpecific(0);

				const proofEntity = await this._proofStorage.get(proofId);

				if (Is.object(proofEntity)) {
					proofEntity.notarizationId = task.result.notarizationId;

					// Update the date created if we can extract it from the VC
					const validFrom = VerifiableCredentialHelper.getValidFrom(
						task.result.verifiableCredential
					);
					if (Is.stringValue(validFrom)) {
						proofEntity.dateCreated = validFrom;
					}
					proofEntity.vcContext = VerifiableCredentialHelper.getContext(
						task.result.verifiableCredential
					);

					await this._proofStorage.set(proofEntity);

					await this._logging?.log({
						source: ImmutableProofService.CLASS_NAME,
						level: "info",
						ts: Date.now(),
						message: "createdProof",
						data: { proofId: task.payload.proofId }
					});

					await this._eventBusComponent?.publish<IImmutableProofEventBusProofCreated>(
						ImmutableProofTopics.ProofCreated,
						{ id: new Urn(ImmutableProofService._NAMESPACE, task.payload.proofId).toString() }
					);
				} else if (Is.stringValue(task.result.notarizationId)) {
					// The proof was removed before the task completed; clean up the orphaned notarization.
					await this._notarizationConnector.remove(
						task.payload.identity,
						task.result.notarizationId
					);
				}

				// The result has been processed, only failed task records need retaining.
				try {
					await this._backgroundTaskComponent.remove(task.id);
				} catch (error) {
					await this._logging?.log({
						source: ImmutableProofService.CLASS_NAME,
						level: "warn",
						ts: Date.now(),
						message: "taskRecordRemoveFailed",
						error: BaseError.fromError(error),
						data: { proofId: task.payload.proofId }
					});
				}
			} else if (task.status === TaskStatus.Failed) {
				await this._logging?.log({
					source: ImmutableProofService.CLASS_NAME,
					level: "error",
					ts: Date.now(),
					message: "createProofFailed",
					error: BaseError.fromError(task.error),
					data: { proofId: task.payload.proofId }
				});
			}
		}
	}

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @param verify Validate the proof.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 * @internal
	 */
	private async internalGet(
		id: string,
		verify: boolean
	): Promise<{
		verified: boolean;
		failure?: ImmutableProofFailure;
		verifiableCredential: IImmutableProofCredential;
	}> {
		const urnParsed = Urn.fromValidString(id);
		const proofId = urnParsed.namespaceSpecific(0);
		const proofEntity = await this._proofStorage.get(proofId);

		if (Is.empty(proofEntity)) {
			throw new NotFoundError(ImmutableProofService.CLASS_NAME, "proofNotFound", id);
		}

		const verifiableCredential: IImmutableProofCredential = {
			"@context": [
				proofEntity.vcContext ?? DidContexts.ContextVCv1,
				ImmutableProofContexts.Context,
				ImmutableProofContexts.ContextCommon
			],
			type: [DidTypes.VerifiableCredential, ImmutableProofTypes.ImmutableProof],
			id,
			issuer: proofEntity.organizationId,
			credentialSubject: {
				id: proofEntity.proofObjectId,
				proofIntegrity: proofEntity.proofObjectIntegrity
			}
		} as IImmutableProofCredential;

		VerifiableCredentialHelper.setValidFrom(
			verifiableCredential as IDidVerifiableCredential,
			proofEntity.dateCreated
		);

		let verified = false;
		let failure: ImmutableProofFailure | undefined = ImmutableProofFailure.NotIssued;

		if (Is.stringValue(proofEntity.notarizationId)) {
			failure = ImmutableProofFailure.ProofMissing;
			const notarization = await this._notarizationConnector.get(proofEntity.notarizationId);

			if (Is.uint8Array(notarization.data)) {
				const proof = ObjectHelper.fromBytes<IProof>(notarization.data);

				// Reinstate verificationMethod (stripped at signing time to reduce identity linkage).
				const proofForVerification = {
					...proof,
					verificationMethod: `${proofEntity.organizationId}#${this._verificationMethodId}`
				};

				// Keep notarizationId on the proof in the response so callers can read proof.notarizationId,
				// but do NOT include it in the object passed to checkVerifiableCredential - the hash covers
				// the whole proof except proofValue, so an injected notarizationId would break the signature.
				verifiableCredential.proof = {
					...proofForVerification,
					notarizationId: proofEntity.notarizationId
				};

				if (verify && Is.object<IProof>(proof)) {
					try {
						// Reconstitute the credential as it was originally signed so verification
						// produces a byte-identical input to what was hashed at signing time.
						// createVerifiableCredential sets type as a plain string (not an array) and
						// preserves the credentialSubject type field from the original subject payload,
						// but the response credential rebuilds type as an array and omits the subject type.
						const credentialToVerify: IDidVerifiableCredential = {
							...verifiableCredential,
							type: DidTypes.VerifiableCredential,
							credentialSubject: {
								type: ImmutableProofTypes.ImmutableProof,
								id: proofEntity.proofObjectId,
								proofIntegrity: proofEntity.proofObjectIntegrity
							},
							proof: proofForVerification as IProof
						} as IDidVerifiableCredential;

						const result =
							await this._identityConnector.checkVerifiableCredential(credentialToVerify);
						if (result.revoked) {
							verified = false;
							failure = ImmutableProofFailure.Revoked;
						} else {
							verified = true;
							failure = undefined;
						}
					} catch {
						verified = false;
						failure = ImmutableProofFailure.VerificationFailure;
					}
				}
			}
		}

		return {
			verifiableCredential: await JsonLdProcessor.compact(
				verifiableCredential,
				JsonLdProcessor.gatherContexts(verifiableCredential)
			),
			verified,
			failure
		};
	}
}
