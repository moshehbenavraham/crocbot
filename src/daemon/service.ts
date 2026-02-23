import type { GatewayServiceRuntime } from "./service-runtime.js";
import {
  installSystemdService,
  isSystemdServiceEnabled,
  readSystemdServiceExecStart,
  readSystemdServiceRuntime,
  restartSystemdService,
  stopSystemdService,
  uninstallSystemdService,
} from "./systemd.js";

export type GatewayServiceInstallArgs = {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
  description?: string;
};

export type GatewayService = {
  label: string;
  loadedText: string;
  notLoadedText: string;
  install: (args: GatewayServiceInstallArgs) => Promise<void>;
  uninstall: (args: {
    env: Record<string, string | undefined>;
    stdout: NodeJS.WritableStream;
  }) => Promise<void>;
  stop: (args: {
    env?: Record<string, string | undefined>;
    stdout: NodeJS.WritableStream;
  }) => Promise<void>;
  restart: (args: {
    env?: Record<string, string | undefined>;
    stdout: NodeJS.WritableStream;
  }) => Promise<void>;
  isLoaded: (args: { env?: Record<string, string | undefined> }) => Promise<boolean>;
  readCommand: (env: Record<string, string | undefined>) => Promise<{
    programArguments: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
    sourcePath?: string;
  } | null>;
  readRuntime: (env: Record<string, string | undefined>) => Promise<GatewayServiceRuntime>;
};

export function resolveGatewayService(): GatewayService {
  return {
    label: "systemd",
    loadedText: "enabled",
    notLoadedText: "disabled",
    install: async (args) => {
      await installSystemdService(args);
    },
    uninstall: async (args) => {
      await uninstallSystemdService(args);
    },
    stop: async (args) => {
      await stopSystemdService({
        stdout: args.stdout,
        env: args.env,
      });
    },
    restart: async (args) => {
      await restartSystemdService({
        stdout: args.stdout,
        env: args.env,
      });
    },
    isLoaded: async (args) => isSystemdServiceEnabled(args),
    readCommand: readSystemdServiceExecStart,
    readRuntime: async (env) => await readSystemdServiceRuntime(env),
  };
}
