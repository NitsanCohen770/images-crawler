module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/__mocks__/axios.js'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
