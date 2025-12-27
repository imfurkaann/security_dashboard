module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)',
    ],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/server.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    globalTeardown: '<rootDir>/tests/globalTeardown.ts',
    // Test ortamı için timeout artır
    testTimeout: 30000,
    // Verbose çıktı
    verbose: false,
    // Force exit (open handles sorununu çöz)
    forceExit: true,
    // Detect open handles (debug için)
    detectOpenHandles: false,
};
