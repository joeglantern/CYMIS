export {
  CATEGORY_IDENTIFIERS,
  CONTAINER_NUMBER_PATTERN,
  LETTER_VALUES,
  computeCheckDigit,
  formatContainerNumber,
  isValidContainerNumber,
  normalise,
  parseContainerNumber,
  validateContainerNumber,
  type CategoryIdentifier,
  type ContainerNumberParts,
  type ValidationResult,
} from './check-digit.js';

export { cleanOcrText, extractCandidates, type OcrCandidate } from './ocr.js';
