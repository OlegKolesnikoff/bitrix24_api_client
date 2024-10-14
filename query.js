module.exports = function httpBuildQuery(queryData, tempKey, queryString) {
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
