// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	TaskStatus,
	type IBackgroundTask,
	type IBackgroundTaskComponent
} from "@twin.org/background-task-models";
import { ContextIdHelper, ContextIdKeys, ContextIdStore } from "@twin.org/context";
import {
	BaseError,
	ComponentFactory,
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
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import { IdentityConnectorFactory, type IIdentityConnector } from "@twin.org/identity-models";
import {
	ImmutableProofContexts,
	ImmutableProofFailure,
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
	type INotarizationConnector
} from "@twin.org/notarization-models";
import {
	DidContexts,
	DidTypes,
	VerifiableCredentialHelper,
	type IDidVerifiableCredential,
	type IProof
} from "@twin.org/standards-w3c-did";
import type { ImmutableProof } from "./entities/immutableProof.js";
import type { IImmutableProofServiceConfig } from "./models/IImmutableProofServiceConfig.js";
import type { IImmutableProofServiceConstructorOptions } from "./models/IImmutableProofServiceConstructorOptions.js";

/**
 * Class for performing immutable proof operations.
 */
export class ImmutableProofService implements IImmutableProofComponent {
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
	 * Create a new instance of ImmutableProofService.
	 * @param options The dependencies for the immutable proof connector.
	 */
	constructor(options?: IImmutableProofServiceConstructorOptions) {
		this._proofStorage = EntityStorageConnectorFactory.get(
			options?.immutableProofEntityStorageType ?? nameofKebabCase<ImmutableProof>()
		);

		this._notarizationConnectorType = options?.notarizationConnectorType ?? "notarization";
		this._notarizationConnector = NotarizationConnectorFactory.get(this._notarizationConnectorType);

		this._logging = ComponentFactory.getIfExists<ILoggingComponent>(
			options?.loggingComponentType ?? "logging"
		);

		this._identityConnectorType = options?.identityConnectorType ?? "identity";

		this._identityConnector = IdentityConnectorFactory.get(this._identityConnectorType);

		this._backgroundTaskComponent = ComponentFactory.get(
			options?.backgroundTaskComponentType ?? "background-task"
		);

		if (Is.stringValue(options?.eventBusComponentType)) {
			this._eventBusComponent = ComponentFactory.get(options.eventBusComponentType);
		}

		this._config = options?.config ?? {};

		this._verificationMethodId = this._config.verificationMethodId ?? "immutable-proof-assertion";
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return ImmutableProofService.CLASS_NAME;
	}

	/**
	 * The component needs to be started when the node is initialized.
	 * @param nodeLoggingComponentType The node logging component type.
	 * @returns Nothing.
	 */
	public async start(nodeLoggingComponentType?: string): Promise<void> {
		await this._backgroundTaskComponent.registerHandler<
			IImmutableProofTaskPayload,
			IImmutableProofTaskResult
		>("immutable-proof", "@twin.org/immutable-proof-task", "processProofTask", async task => {
			await this.finaliseTask(task);
		});
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

			const proofObjectId = ObjectHelper.extractProperty<string>(document, ["@id", "id"], false);

			// We don't want to store the whole document in the immutable proof, as this could be large
			// and also reveal information that should not be stored in the proof so we hash the document
			// and store the hash
			const proofObjectIntegrity = IntegrityHelper.generate(
				IntegrityAlgorithm.Sha256,
				ObjectHelper.toBytes(JsonHelper.canonicalize(document))
			);

			const credentialSubject: IImmutableProof = {
				"@context": [ImmutableProofContexts.Context, ImmutableProofContexts.ContextCommon],
				type: ImmutableProofTypes.ImmutableProof,
				id: proofObjectId,
				proofIntegrity: proofObjectIntegrity
			};

			const proofEntity: ImmutableProof = {
				id,
				organizationId: contextIds[ContextIdKeys.Organization],
				dateCreated,
				proofObjectId,
				proofObjectIntegrity
			};
			await this._proofStorage.set(proofEntity);

			const fullId = new Urn(ImmutableProofService._NAMESPACE, id).toString();

			const proofTaskPayload: IImmutableProofTaskPayload = {
				proofId: fullId,
				identity: contextIds[ContextIdKeys.Organization],
				identityConnectorType: this._identityConnectorType,
				notarizationConnectorType: this._notarizationConnectorType,
				verificationMethodId: this._verificationMethodId,
				credentialSubject,
				deleteLockDateTime: options?.deleteLock
			};

			await this._backgroundTaskComponent.create("immutable-proof", proofTaskPayload, {
				retainFor: 5000
			});

			return fullId;
		} catch (error) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "createFailed", undefined, error);
		}
	}

	/**
	 * Get a proof.
	 * @param id The id of the proof to get.
	 * @returns The proof.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async get(id: string): Promise<IImmutableProofCredential> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

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

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async verify(id: string): Promise<IImmutableProofVerification> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

		try {
			const { verified, failure } = await this.internalGet(id, true);

			return {
				"@context": ImmutableProofContexts.Context,
				type: ImmutableProofTypes.ImmutableProofVerification,
				verified,
				failure
			};
		} catch (error) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "verifyFailed", undefined, error);
		}
	}

	/**
	 * Remove the proof and its notarization.
	 * @param id The id of the proof to remove.
	 * @returns Nothing.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async remove(id: string): Promise<void> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);
		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Organization);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

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
		} catch (error) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "removeFailed", undefined, error);
		}
	}

	/**
	 * Remove only the notarization for the proof, keeping the proof entity.
	 * @param id The id of the proof to remove the notarization from.
	 * @returns Nothing.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async removeNotarization(id: string): Promise<void> {
		Guards.stringValue(ImmutableProofService.CLASS_NAME, nameof(id), id);
		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Organization);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(ImmutableProofService.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

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
	 * Process a proof.
	 * @param proofEntity The proof entity to process.
	 * @internal
	 */
	private async finaliseTask(
		task: IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>
	): Promise<void> {
		if (Is.object(task.payload)) {
			if (task.status === TaskStatus.Success && Is.object(task.result)) {
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
			} else if (task.status === TaskStatus.Failed) {
				await this._logging?.log({
					source: ImmutableProofService.CLASS_NAME,
					level: "error",
					ts: Date.now(),
					message: "createProofFailed",
					error: BaseError.fromError(task.error)
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

				const proofWithReceipt = {
					...proof,
					verificationMethod: `${proofEntity.organizationId}#${this._verificationMethodId}`,
					notarizationId: proofEntity.notarizationId
				};

				verifiableCredential.proof = proofWithReceipt;

				if (verify && Is.object<IProof>(proof)) {
					try {
						const result = await this._identityConnector.checkVerifiableCredential(
							verifiableCredential as IDidVerifiableCredential
						);
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
