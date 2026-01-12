// src/utils/publicUrl.js
// dev: '/'  prod: './'  => 언제나 올바른 경로를 만들어줌
export const publicUrl = (relPath) => `${import.meta.env.BASE_URL}${relPath}`;
