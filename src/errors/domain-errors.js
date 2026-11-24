import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-dictionary.js";

// Cada error del dominio es una clase propia: new UserNotFoundError() ya trae código, status y mensaje.
// Opcionalmente: new InvalidMockAmountError("mensaje específico", "detalle para debugging").
const defineError = (name, code) => {
  const ErrorClass = class extends AppError {
    constructor(message, details, cause) {
      super(code, message, details, cause);
    }
  };
  Object.defineProperty(ErrorClass, "name", { value: name });
  return ErrorClass;
};

export const ValidationError = defineError("ValidationError", ERROR_CODES.VALIDATION_ERROR);
export const MissingFieldsError = defineError("MissingFieldsError", ERROR_CODES.MISSING_FIELDS);
export const InvalidEmailError = defineError("InvalidEmailError", ERROR_CODES.INVALID_EMAIL);
export const InvalidPasswordError = defineError("InvalidPasswordError", ERROR_CODES.INVALID_PASSWORD);
export const InvalidJsonError = defineError("InvalidJsonError", ERROR_CODES.INVALID_JSON);
export const InvalidPriceError = defineError("InvalidPriceError", ERROR_CODES.INVALID_PRICE);
export const InvalidStockError = defineError("InvalidStockError", ERROR_CODES.INVALID_STOCK);
export const InvalidProductStatusError = defineError("InvalidProductStatusError", ERROR_CODES.INVALID_PRODUCT_STATUS);
export const InvalidOrderStatusError = defineError("InvalidOrderStatusError", ERROR_CODES.INVALID_ORDER_STATUS);
export const InvalidMockAmountError = defineError("InvalidMockAmountError", ERROR_CODES.INVALID_MOCK_AMOUNT);
export const InvalidMockRoleError = defineError("InvalidMockRoleError", ERROR_CODES.INVALID_MOCK_ROLE);
export const MockNoCustomersError = defineError("MockNoCustomersError", ERROR_CODES.MOCK_NO_CUSTOMERS);
export const MockNoDriversError = defineError("MockNoDriversError", ERROR_CODES.MOCK_NO_DRIVERS);
export const UnauthorizedError = defineError("UnauthorizedError", ERROR_CODES.UNAUTHORIZED);
export const InvalidCredentialsError = defineError("InvalidCredentialsError", ERROR_CODES.INVALID_CREDENTIALS);
export const ForbiddenError = defineError("ForbiddenError", ERROR_CODES.FORBIDDEN);
export const UserNotFoundError = defineError("UserNotFoundError", ERROR_CODES.USER_NOT_FOUND);
export const ProductNotFoundError = defineError("ProductNotFoundError", ERROR_CODES.PRODUCT_NOT_FOUND);
export const OrderNotFoundError = defineError("OrderNotFoundError", ERROR_CODES.ORDER_NOT_FOUND);
export const RouteNotFoundError = defineError("RouteNotFoundError", ERROR_CODES.ROUTE_NOT_FOUND);
export const EmailExistsError = defineError("EmailExistsError", ERROR_CODES.EMAIL_EXISTS);
export const ProductExistsError = defineError("ProductExistsError", ERROR_CODES.PRODUCT_EXISTS);
export const DuplicateKeyError = defineError("DuplicateKeyError", ERROR_CODES.DUPLICATE_KEY);
export const MockGenerationError = defineError("MockGenerationError", ERROR_CODES.MOCK_GENERATION_ERROR);
export const DatabaseError = defineError("DatabaseError", ERROR_CODES.DATABASE_ERROR);
export const InternalServerError = defineError("InternalServerError", ERROR_CODES.INTERNAL_SERVER_ERROR);
export const InvalidOrderItemsError = defineError("InvalidOrderItemsError", ERROR_CODES.INVALID_ORDER_ITEMS);
export const InvalidPriorityError = defineError("InvalidPriorityError", ERROR_CODES.INVALID_PRIORITY);
export const InvalidDeliveryStatusError = defineError("InvalidDeliveryStatusError", ERROR_CODES.INVALID_DELIVERY_STATUS);
export const InvalidDriverError = defineError("InvalidDriverError", ERROR_CODES.INVALID_DRIVER);
export const DeliveryNotFoundError = defineError("DeliveryNotFoundError", ERROR_CODES.DELIVERY_NOT_FOUND);
export const FileRequiredError = defineError("FileRequiredError", ERROR_CODES.FILE_REQUIRED);
export const InvalidFileTypeError = defineError("InvalidFileTypeError", ERROR_CODES.INVALID_FILE_TYPE);
export const InvalidFileFieldError = defineError("InvalidFileFieldError", ERROR_CODES.INVALID_FILE_FIELD);
export const InvalidDocumentTypeError = defineError("InvalidDocumentTypeError", ERROR_CODES.INVALID_DOCUMENT_TYPE);
export const FileTooLargeError = defineError("FileTooLargeError", ERROR_CODES.FILE_TOO_LARGE);
export const UploadError = defineError("UploadError", ERROR_CODES.UPLOAD_ERROR);
export const InvalidRoleError = defineError("InvalidRoleError", ERROR_CODES.INVALID_ROLE);
export const InvalidSortError = defineError("InvalidSortError", ERROR_CODES.INVALID_SORT);
export const PayloadTooLargeError = defineError("PayloadTooLargeError", ERROR_CODES.PAYLOAD_TOO_LARGE);
