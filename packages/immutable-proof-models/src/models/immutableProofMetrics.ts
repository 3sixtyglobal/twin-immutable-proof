// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { type ITelemetryMetric, MetricType } from "@3sixty/telemetry-models";
import { ImmutableProofMetricIds } from "./immutableProofMetricIds.js";

/**
 * Metrics registered by the immutable proof service.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ImmutableProofMetrics: ITelemetryMetric[] = [
	{
		id: ImmutableProofMetricIds.ProofsCreated,
		label: "Proofs created",
		type: MetricType.Counter
	},
	{
		id: ImmutableProofMetricIds.VerificationsSucceeded,
		label: "Proof verifications succeeded",
		type: MetricType.Counter
	},
	{
		id: ImmutableProofMetricIds.VerificationsFailed,
		label: "Proof verifications failed",
		type: MetricType.Counter
	},
	{
		id: ImmutableProofMetricIds.ProofsRemoved,
		label: "Proofs removed",
		type: MetricType.Counter
	},
	{
		id: ImmutableProofMetricIds.NotarizationsRemoved,
		label: "Notarizations removed",
		type: MetricType.Counter
	},
	{
		id: ImmutableProofMetricIds.ProofCompletionLag,
		label: "Proof completion lag",
		type: MetricType.Gauge,
		unit: "ms"
	}
];
