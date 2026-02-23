import { findLegacySystemdUnits, uninstallLegacySystemdUnits } from "./systemd.js";

export type LegacyGatewayService = {
  platform: "linux";
  label: string;
  detail: string;
};

function formatLegacySystemdUnits(
  units: Awaited<ReturnType<typeof findLegacySystemdUnits>>,
): LegacyGatewayService[] {
  return units.map((unit) => ({
    platform: "linux",
    label: `${unit.name}.service`,
    detail: [
      unit.enabled ? "enabled" : "disabled",
      unit.exists ? `unit: ${unit.unitPath}` : "unit missing",
    ].join(", "),
  }));
}

export async function findLegacyGatewayServices(
  env: Record<string, string | undefined>,
): Promise<LegacyGatewayService[]> {
  const units = await findLegacySystemdUnits(env);
  return formatLegacySystemdUnits(units);
}

export async function uninstallLegacyGatewayServices({
  env,
  stdout,
}: {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
}): Promise<LegacyGatewayService[]> {
  const units = await uninstallLegacySystemdUnits({ env, stdout });
  return formatLegacySystemdUnits(units);
}
