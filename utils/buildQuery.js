/**
 * Преобразует JavaScript объект в URL-строку запроса, аналогично функции http_build_query в PHP.
 * Поддерживает вложенные объекты, используя нотацию массивов (например, parent[child]).
 * 
 * @param {Object} queryData - Объект, который нужно преобразовать в строку запроса
 * @param {string|null} [tempKey=null] - Внутренний параметр, используемый для рекурсии, чтобы отслеживать текущий путь ключа
 * @param {URLSearchParams} [queryString=new URLSearchParams()] - Внутренний параметр для накопления строки запроса
 * @returns {URLSearchParams|string} - Возвращает объект URLSearchParams или пустую строку, если queryData имеет ложное значение
 * 
 * @example
 * // Простой объект
 * httpBuildQuery({ a: 1, b: 2 }) // Возвращает URLSearchParams с "a=1&b=2"
 * 
 * @example
 * // Вложенный объект
 * httpBuildQuery({ a: { b: 1, c: 2 } }) // Возвращает URLSearchParams с "a[b]=1&a[c]=2"
 * 
 * @example
 * // С логическими значениями
 * httpBuildQuery({ a: true, b: false }) // Возвращает URLSearchParams с "a=1&b=0"
 */
function httpBuildQuery(queryData, tempKey, queryString) {
  tempKey ||= null;
  queryString ||= new URLSearchParams();
  if (!queryData) return '';
  for (const k of Object.keys(queryData)) {
    let key = k;
    if (tempKey) key = tempKey + '[' + key + ']';
    if (typeof queryData[k] === 'object' && queryData[k] !== null) {
      httpBuildQuery(queryData[k], key, queryString);
    } else {
      let val = queryData[k];
      val = val === true ? '1' : val;
      val = val === false ? '0' : val;
      val = val === 0 ? '0' : val;
      val ||= '';
      queryString.set(key, val);
    }
  }
  return queryString;
};

module.exports = httpBuildQuery;
