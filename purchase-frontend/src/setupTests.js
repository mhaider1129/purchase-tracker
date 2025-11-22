// src/setupTests.js

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder / TextDecoder for Jest environment
if (typeof global.TextEncoder === "undefined") {
  // eslint-disable-next-line no-undef
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === "undefined") {
  // eslint-disable-next-line no-undef
  global.TextDecoder = TextDecoder;
}