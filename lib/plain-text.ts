const ANGLE_BRACKET_PATTERN = /[<>]/;
const LEFT_ANGLE_BRACKET_PATTERN = /</;
const HTML_TAG_PATTERN = /<[^>]*>/;

type SanitizePlainTextOptions = {
  allowGreaterThan?: boolean;
};

export const sanitizePlainText = (
  value: unknown,
  fieldName: string,
  maxLength: number,
  options?: SanitizePlainTextOptions
): string => {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} exceeds max length ${maxLength}`);
  }
  const forbiddenBracketPattern = options?.allowGreaterThan ? LEFT_ANGLE_BRACKET_PATTERN : ANGLE_BRACKET_PATTERN;
  if (forbiddenBracketPattern.test(normalized) || HTML_TAG_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be plain text only`);
  }

  return normalized;
};

export const sanitizeOptionalPlainText = (
  value: unknown,
  fieldName: string,
  maxLength: number,
  options?: SanitizePlainTextOptions
): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return sanitizePlainText(String(value), fieldName, maxLength, options);
};
