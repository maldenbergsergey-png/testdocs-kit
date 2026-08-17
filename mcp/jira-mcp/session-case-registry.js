function getCreatedCaseKey(result) {
  const key = result?.key || result?.testCaseKey;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function createSessionCaseRegistry() {
  const createdKeys = new Set();

  return {
    recordCreated(result) {
      const key = getCreatedCaseKey(result);
      if (key) createdKeys.add(key);
      return key;
    },

    assertEditable(testCaseKey) {
      if (!createdKeys.has(testCaseKey)) {
        throw new Error(
          `Test case ${testCaseKey} cannot be updated: only cases created by this MCP process during the current session are editable.`
        );
      }
    },

    has(testCaseKey) {
      return createdKeys.has(testCaseKey);
    }
  };
}

module.exports = { createSessionCaseRegistry, getCreatedCaseKey };
