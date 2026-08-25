export class ProblemError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string;
  readonly extras?: Record<string, unknown>;

  constructor(params: {
    status: number;
    type: string;
    title: string;
    detail: string;
    extras?: Record<string, unknown>;
  }) {
    super(params.detail);
    this.status = params.status;
    this.type = params.type;
    this.title = params.title;
    this.detail = params.detail;
    this.extras = params.extras;
  }
}

export const badRequest = (detail: string, extras?: Record<string, unknown>) =>
  new ProblemError({
    status: 400,
    type: "https://finance-api.dev/problems/bad-request",
    title: "Bad Request",
    detail,
    extras,
  });

export const unauthorized = (detail = "Credenciais inválidas ou ausentes") =>
  new ProblemError({
    status: 401,
    type: "https://finance-api.dev/problems/unauthorized",
    title: "Unauthorized",
    detail,
  });

export const forbidden = (detail = "Acesso negado") =>
  new ProblemError({
    status: 403,
    type: "https://finance-api.dev/problems/forbidden",
    title: "Forbidden",
    detail,
  });

export const notFound = (detail = "Recurso não encontrado") =>
  new ProblemError({
    status: 404,
    type: "https://finance-api.dev/problems/not-found",
    title: "Not Found",
    detail,
  });

export const conflict = (detail: string, extras?: Record<string, unknown>) =>
  new ProblemError({
    status: 409,
    type: "https://finance-api.dev/problems/conflict",
    title: "Conflict",
    detail,
    extras,
  });

export const unprocessable = (detail: string, extras?: Record<string, unknown>) =>
  new ProblemError({
    status: 422,
    type: "https://finance-api.dev/problems/unprocessable-entity",
    title: "Unprocessable Entity",
    detail,
    extras,
  });
