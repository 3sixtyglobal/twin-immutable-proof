// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BackgroundTaskConnectorFactory,
	TaskStatus,
	type IBackgroundTask,
	type IBackgroundTaskConnector
} from "@twin.org/background-task-models";
import {
	ComponentFactory,
	Converter,
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
import { Sha256 } from "@twin.org/crypto";
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
	type IImmutableProofEventBusProofCreated,
	type IImmutableProofVerification
} from "@twin.org/immutable-proof-models";
import type {
	IImmutableProofTaskPayload,
	IImmutableProofTaskResult
} from "@twin.org/immutable-proof-task";
import { nameof, nameofKebabCase } from "@twin.org/nameof";
import { DidCryptoSuites, ProofTypes } from "@twin.org/standards-w3c-did";
import {
	VerifiableStorageConnectorFactory,
	type IVerifiableStorageConnector
} from "@twin.org/verifiable-storage-models";
import type { ImmutableProof } from "./entities/immutableProof";
import type { IImmutableProofServiceConfig } from "./models/IImmutableProofServiceConfig";
import type { IImmutableProofServiceConstructorOptions } from "./models/IImmutableProofServiceConstructorOptions";

/**
 * Class for performing immutable proof operations.
 */
export class ImmutableProofService implements IImmutableProofComponent {
	/**
	 * The namespace for the service.
	 * @internal
	 */
	private static readonly _NAMESPACE: string = "immutable-proof";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<ImmutableProofService>();

	/**
	 * The configuration for the connector.
	 * @internal
	 */
	private readonly _config: IImmutableProofServiceConfig;

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
	 * The verifiable storage for the credentials.
	 * @internal
	 */
	private readonly _verifiableStorage: IVerifiableStorageConnector;

	/**
	 * The background task connector.
	 * @internal
	 */
	private readonly _backgroundTaskConnector: IBackgroundTaskConnector;

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

		this._verifiableStorage = VerifiableStorageConnectorFactory.get(
			options?.verifiableStorageType ?? "verifiable-storage"
		);

		this._identityConnectorType = options?.identityConnectorType ?? "identity";

		this._identityConnector = IdentityConnectorFactory.get(this._identityConnectorType);

		this._backgroundTaskConnector = BackgroundTaskConnectorFactory.get(
			options?.backgroundTaskConnectorType ?? "background-task"
		);

		if (Is.stringValue(options?.eventBusComponentType)) {
			this._eventBusComponent = ComponentFactory.get(options.eventBusComponentType);
		}

		this._config = options?.config ?? {};
		this._verificationMethodId = this._config.verificationMethodId ?? "immutable-proof-assertion";

		this._backgroundTaskConnector.registerHandler<
			IImmutableProofTaskPayload,
			IImmutableProofTaskResult
		>("immutable-proof", "@twin.org/immutable-proof-task", "processProofTask", async task => {
			await this.finaliseTask(task);
		});
	}

	/**
	 * Create a new proof.
	 * @param document The document to create the proof for.
	 * @param userIdentity The identity to create the immutable proof operation with.
	 * @param nodeIdentity The node identity to use for vault operations.
	 * @returns The id of the new proof.
	 */
	public async create(
		document: IJsonLdNodeObject,
		userIdentity?: string,
		nodeIdentity?: string
	): Promise<string> {
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(document), document);
		Guards.stringValue(this.CLASS_NAME, nameof(userIdentity), userIdentity);
		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);

		try {
			const validationFailures: IValidationFailure[] = [];
			await JsonLdHelper.validate(document, validationFailures);
			Validation.asValidationError(this.CLASS_NAME, nameof(document), validationFailures);

			const id = Converter.bytesToHex(RandomHelper.generate(32), false);

			const dateCreated = new Date(Date.now()).toISOString();

			const proofObjectId = ObjectHelper.extractProperty<string>(document, ["@id", "id"], false);

			// We don't want to store the whole document in the immutable proof, as this could be large
			// and also reveal information that should not be stored in the proof so we hash the document
			// and store the hash
			const proofObjectHash = this.calculateDocumentHash(document);

			const proofEntity: ImmutableProof = {
				id,
				nodeIdentity,
				userIdentity,
				dateCreated,
				proofObjectId,
				proofObjectHash
			};
			await this._proofStorage.set(proofEntity);

			const immutableProof = this.proofEntityToJsonLd(proofEntity);

			const proofTaskPayload: IImmutableProofTaskPayload = {
				proofId: id,
				nodeIdentity,
				identityConnectorType: this._identityConnectorType,
				verificationMethodId: this._verificationMethodId,
				document: immutableProof as unknown as IJsonLdNodeObject
			};

			await this._backgroundTaskConnector.create("immutable-proof", proofTaskPayload);

			return new Urn(ImmutableProofService._NAMESPACE, id).toString();
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createFailed", undefined, error);
		}
	}

	/**
	 * Get a proof.
	 * @param id The id of the proof to get.
	 * @returns The proof.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async get(id: string): Promise<IImmutableProof> {
		Guards.stringValue(this.CLASS_NAME, nameof(id), id);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

		try {
			const { immutableProof } = await this.internalGet(id, false);

			return JsonLdProcessor.compact(immutableProof, immutableProof["@context"]);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "getFailed", undefined, error);
		}
	}

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async verify(id: string): Promise<IImmutableProofVerification> {
		Guards.stringValue(this.CLASS_NAME, nameof(id), id);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

		try {
			const { verified, failure } = await this.internalGet(id, true);

			return {
				"@context": ImmutableProofContexts.ContextRoot,
				type: ImmutableProofTypes.ImmutableProofVerification,
				verified,
				failure
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "verifyFailed", undefined, error);
		}
	}

	/**
	 * Remove the verifiable storage for the proof.
	 * @param id The id of the proof to remove the storage from.
	 * @param nodeIdentity The node identity to use for vault operations.
	 * @returns Nothing.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async removeVerifiable(id: string, nodeIdentity?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(id), id);
		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== ImmutableProofService._NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: ImmutableProofService._NAMESPACE,
				id
			});
		}

		try {
			const streamId = urnParsed.namespaceSpecific(0);
			const streamEntity = await this._proofStorage.get(streamId);

			if (Is.empty(streamEntity)) {
				throw new NotFoundError(this.CLASS_NAME, "proofNotFound", id);
			}

			if (Is.stringValue(streamEntity.verifiableStorageId)) {
				await this._verifiableStorage.remove(nodeIdentity, streamEntity.verifiableStorageId);
				delete streamEntity.verifiableStorageId;
				await this._proofStorage.set(streamEntity);
			}
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "removeVerifiableFailed", undefined, error);
		}
	}

	/**
	 * Calculate the object hash.
	 * @param object The entry to calculate the hash for.
	 * @returns The hash.
	 * @internal
	 */
	private calculateDocumentHash(nodeObject: IJsonLdNodeObject): string {
		return `sha256:${Converter.bytesToBase64(Sha256.sum256(ObjectHelper.toBytes(JsonHelper.canonicalize(nodeObject))))}`;
	}

	/**
	 * Map the stream entity to a model.
	 * @param proofEntity The stream entity.
	 * @returns The model.
	 * @internal
	 */
	private proofEntityToJsonLd(proofEntity: ImmutableProof): IImmutableProof {
		const jsonLd: IImmutableProof = {
			"@context": [ImmutableProofContexts.ContextRoot, ImmutableProofContexts.ContextRootCommon],
			type: ImmutableProofTypes.ImmutableProof,
			id: proofEntity.id,
			nodeIdentity: proofEntity.nodeIdentity,
			userIdentity: proofEntity.userIdentity,
			proofObjectId: proofEntity.proofObjectId,
			proofObjectHash: proofEntity.proofObjectHash,
			verifiableStorageId: proofEntity.verifiableStorageId
		};

		return jsonLd;
	}

	/**
	 * Process a proof.
	 * @param proofEntity The proof entity to process.
	 * @internal
	 */
	private async finaliseTask(
		task: IBackgroundTask<IImmutableProofTaskPayload, IImmutableProofTaskResult>
	): Promise<void> {
		if (task.status === TaskStatus.Success && Is.object(task.payload) && Is.object(task.result)) {
			const proofEntity = await this._proofStorage.get(task.payload.proofId);

			if (Is.object(proofEntity)) {
				const immutableProof: IImmutableProof = this.proofEntityToJsonLd(proofEntity);

				// As we are adding the proof to the data we update its context
				immutableProof["@context"] = JsonLdProcessor.combineContexts(
					[ImmutableProofContexts.ContextRoot, ImmutableProofContexts.ContextRootCommon],
					task.result.proof["@context"]
				) as IImmutableProof["@context"];
				immutableProof.proof = task.result.proof;
				ObjectHelper.propertyDelete(immutableProof.proof, "@context");

				if (Is.stringValue(immutableProof.proof.created)) {
					proofEntity.dateCreated = immutableProof.proof.created;
				}

				const compacted = await JsonLdProcessor.compact(immutableProof, immutableProof["@context"]);

				const verifiableCreateResult = await this._verifiableStorage.create(
					proofEntity.nodeIdentity,
					ObjectHelper.toBytes(compacted)
				);

				proofEntity.verifiableStorageId = verifiableCreateResult.id;

				await this._proofStorage.set(proofEntity);

				await this._eventBusComponent?.publish<IImmutableProofEventBusProofCreated>(
					ImmutableProofTopics.ProofCreated,
					{ id: new Urn(ImmutableProofService._NAMESPACE, task.payload.proofId).toString() }
				);
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
		immutableProof: IImmutableProof;
	}> {
		const urnParsed = Urn.fromValidString(id);
		const proofId = urnParsed.namespaceSpecific(0);
		const proofEntity = await this._proofStorage.get(proofId);

		if (Is.empty(proofEntity)) {
			throw new NotFoundError(this.CLASS_NAME, "proofNotFound", id);
		}

		let proofJsonLd = this.proofEntityToJsonLd(proofEntity);
		let verified = false;
		let failure: ImmutableProofFailure | undefined = ImmutableProofFailure.NotIssued;

		if (Is.stringValue(proofEntity.verifiableStorageId)) {
			failure = ImmutableProofFailure.ProofMissing;
			const immutableResult = await this._verifiableStorage.get(proofEntity.verifiableStorageId);

			if (Is.uint8Array(immutableResult.data)) {
				proofJsonLd = ObjectHelper.fromBytes<IImmutableProof>(immutableResult.data);

				const unsecureDocument = ObjectHelper.clone(proofJsonLd) as unknown as IJsonLdNodeObject;
				proofJsonLd.immutableReceipt = immutableResult.receipt;
				proofJsonLd.verifiableStorageId = proofEntity.verifiableStorageId;

				// As we are adding the receipt to the data we update the JSON-LD context
				const receiptContext = immutableResult.receipt["@context"];
				if (!Is.empty(receiptContext)) {
					proofJsonLd["@context"] = JsonLdProcessor.combineContexts(
						proofJsonLd["@context"],
						receiptContext
					) as IImmutableProof["@context"];
				}

				if (verify && Is.object(proofJsonLd.proof)) {
					if (proofJsonLd.proof.cryptosuite !== DidCryptoSuites.EdDSAJcs2022) {
						failure = ImmutableProofFailure.CryptoSuiteMismatch;
					} else if (proofJsonLd.proof.type !== ProofTypes.DataIntegrityProof) {
						failure = ImmutableProofFailure.ProofTypeMismatch;
					} else {
						const isVerified = await this._identityConnector.verifyProof(
							unsecureDocument,
							proofJsonLd.proof
						);

						if (isVerified) {
							verified = true;
							failure = undefined;
						} else {
							failure = ImmutableProofFailure.SignatureMismatch;
						}
					}
				}
			}
		}

		return {
			immutableProof: proofJsonLd,
			verified,
			failure
		};
	}
}
