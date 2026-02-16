import { Type } from "@sinclair/typebox";

import { NonEmptyString } from "./primitives.js";

// -- Project summary (returned in list results) --

export const ProjectSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    memoryIsolation: Type.Optional(
      Type.Union([Type.Literal("full"), Type.Literal("shared"), Type.Literal("inherit")]),
    ),
    isDefault: Type.Boolean(),
    workspaceDir: Type.Optional(NonEmptyString),
    createdAt: Type.Optional(NonEmptyString),
    lastAccessedAt: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// -- projects.list --

export const ProjectsListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ProjectsListResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    projects: Type.Array(ProjectSummarySchema),
  },
  { additionalProperties: false },
);

// -- projects.current --

export const ProjectsCurrentParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ProjectsCurrentResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    projectId: NonEmptyString,
    isDefault: Type.Boolean(),
    workspaceDir: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// -- projects.create --

export const ProjectsCreateParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    projectId: NonEmptyString,
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    memoryIsolation: Type.Optional(
      Type.Union([Type.Literal("full"), Type.Literal("shared"), Type.Literal("inherit")]),
    ),
  },
  { additionalProperties: false },
);

export const ProjectsCreateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    projectId: NonEmptyString,
    workspaceDir: NonEmptyString,
  },
  { additionalProperties: false },
);

// -- projects.delete --

export const ProjectsDeleteParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    projectId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ProjectsDeleteResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    projectId: NonEmptyString,
  },
  { additionalProperties: false },
);

// -- projects.switch --

export const ProjectsSwitchParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    projectId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ProjectsSwitchResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    projectId: NonEmptyString,
    previousProjectId: Type.Optional(NonEmptyString),
    workspaceDir: NonEmptyString,
  },
  { additionalProperties: false },
);
