import { PAGINATION } from "../constants/index.js";

// Convierte page/limit de la query en números válidos (con tope máximo).
export const parsePagination = ({ page, limit }) => {
  // Valores inválidos (texto, 0, negativos) vuelven al valor por defecto; limit nunca supera el máximo.
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  const currentPage = parsedPage >= 1 ? parsedPage : PAGINATION.DEFAULT_PAGE;
  const pageLimit = parsedLimit >= 1 ? Math.min(parsedLimit, PAGINATION.MAX_LIMIT) : PAGINATION.DEFAULT_LIMIT;

  return { page: currentPage, limit: pageLimit, skip: (currentPage - 1) * pageLimit };
};

export const buildPage = ({ data, total, page, limit }) => ({
  data,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});
