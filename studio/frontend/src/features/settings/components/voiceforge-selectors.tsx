import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/api";
import { useExternalProvidersStore } from "@/features/chat";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SettingsRow } from "./settings-row";
import { useVoiceSettingsStore } from "../stores/voice-settings-store";

type AudioOptions = {
	speech_models: { id: string; voices: string[]; voice_labels?: Record<string, string> }[];
	recognition_models: string[];
	rvc_models: string[];
};

export function VoiceForgeSelectors({
	providerId,
	kind,
}: { providerId: string; kind: "speech" | "recognition" }) {
	const connection = useExternalProvidersStore((s) =>
		s.providers.find((p) => p.id === providerId),
	);
	const model = useVoiceSettingsStore((s) =>
		kind === "speech" ? s.ttsProviderModel : s.sttProviderModel,
	);
	const voice = useVoiceSettingsStore((s) => s.ttsProviderVoice);
	const rvc = useVoiceSettingsStore((s) => s.ttsVoiceForgeRvc);
	const [revision, setRevision] = useState(0);
	const [options, setOptions] = useState<{
		data?: AudioOptions;
		error?: Error;
		isFetching: boolean;
	}>({ isFetching: true });
	useEffect(() => {
		const controller = new AbortController();
		setOptions({ isFetching: true });
		void (async () => {
			const response = await authFetch(
				`/api/providers/${encodeURIComponent(providerId)}/voiceforge-options`,
				{ signal: controller.signal },
			);
			const data = await response.json();
			if (!response.ok)
				throw new Error(
					typeof data.detail === "string"
						? data.detail
						: "Could not load VoiceForge options.",
				);
			if (
				!Array.isArray(data.speech_models) ||
				!Array.isArray(data.recognition_models) ||
				!Array.isArray(data.rvc_models)
			) {
				throw new Error(
					"VoiceForge returned an invalid catalog. Update and restart VoiceForge.",
				);
			}
			if (!controller.signal.aborted) setOptions({ data, isFetching: false });
		})().catch((error: unknown) => {
			if (!controller.signal.aborted)
				setOptions({
					error: error instanceof Error ? error : new Error(String(error)),
					isFetching: false,
				});
		});
		return () => controller.abort();
	}, [providerId, connection?.baseUrl, connection?.updatedAt, revision]);
	const models =
		kind === "speech"
			? (options.data?.speech_models.map((m) => m.id) ?? [])
			: (options.data?.recognition_models ?? []);
	const voices =
		options.data?.speech_models.find((m) => m.id === model)?.voices ?? [];
	const voiceLabels = options.data?.speech_models.find((m) => m.id === model)?.voice_labels ?? {};
	const savedVoiceMissing = Boolean(voice && !voices.includes(voice));
	const savedModelMissing = Boolean(model && !models.includes(model));
	const chooseModel = (value: string) => {
		if (kind === "speech") {
			useVoiceSettingsStore.setState({
				ttsProviderModel: value,
				ttsProviderVoice: "",
			});
		} else useVoiceSettingsStore.setState({ sttProviderModel: value });
	};
	return (
		<>
			<SettingsRow
				label="VoiceForge catalog"
				description="Supported speech and recognition models, built-in voices, and installed RVC models."
			>
				<Button
					size="sm"
					variant="outline"
					disabled={options.isFetching}
					onClick={() => setRevision((value) => value + 1)}
				>
					{options.isFetching ? "Loading…" : "Refresh"}
				</Button>
			</SettingsRow>
			{options.error && (
				<p role="alert" className="px-4 text-sm text-destructive">
					{options.error.message}
				</p>
			)}
			<SettingsRow
				label={kind === "speech" ? "Speech model" : "Recognition model"}
			>
				<Select
					value={model}
					onValueChange={chooseModel}
					disabled={!options.data}
				>
					<SelectTrigger
						className="w-64"
						aria-label={
							kind === "speech" ? "Speech model" : "Recognition model"
						}
					>
						<SelectValue placeholder="Choose a model" />
					</SelectTrigger>
					<SelectContent>
						{savedModelMissing && (
							<SelectItem value={model} disabled>
								{model} (unavailable)
							</SelectItem>
						)}
						{models.map((id) => (
							<SelectItem key={id} value={id}>
								{id}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingsRow>
			{kind === "speech" && (
				<>
					<SettingsRow
						label="Voice"
						description={model === "omnivoice" ? "Choose an audio reference from VoiceForge’s prompt library." : "Choose one of this model’s built-in voices."}
					>
						<Select
							value={voice}
							disabled={!options.data || savedModelMissing}
							onValueChange={(value) => {
								useVoiceSettingsStore.setState({
									ttsProviderVoice: value,
								});
							}}
						>
							<SelectTrigger className="w-64" aria-label="VoiceForge voice">
								<SelectValue placeholder="Choose a voice" />
							</SelectTrigger>
							<SelectContent>
								{savedVoiceMissing && (
									<SelectItem value={voice} disabled>
										{options.isFetching ? "Loading saved voice…" : "Saved voice unavailable — choose a voice"}
									</SelectItem>
								)}
								{voices.map((id) => (
									<SelectItem key={id} value={id}>
										{voiceLabels[id] ?? id}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</SettingsRow>
					<SettingsRow
						label="RVC model"
						description="Convert the generated speech using an installed RVC model. This selection applies to Unsloth speech requests."
					>
						<Select
							value={rvc || "__server__"}
							disabled={!options.data}
							onValueChange={(value) =>
								useVoiceSettingsStore.setState({
									ttsVoiceForgeRvc: value === "__server__" ? "" : value,
								})
							}
						>
							<SelectTrigger className="w-64" aria-label="RVC model">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__server__">
									Use VoiceForge settings
								</SelectItem>
								<SelectItem value="__off__">Off</SelectItem>
								{rvc &&
									rvc !== "__off__" &&
									!options.data?.rvc_models.includes(rvc) && (
										<SelectItem value={rvc} disabled>
											{rvc} (unavailable)
										</SelectItem>
									)}
								{options.data?.rvc_models.map((id) => (
									<SelectItem key={id} value={id}>
										{id}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</SettingsRow>
				</>
			)}
		</>
	);
}
