// File: src/utils/helpers.js

const cleanUrl = (rawUrl) => {
  try {
    const parsedUrl = new URL(rawUrl);
    parsedUrl.searchParams.delete("si"); // Remove tracking params
    return parsedUrl.toString();
  } catch (e) {
    return rawUrl;
  }
};

module.exports = { cleanUrl };
