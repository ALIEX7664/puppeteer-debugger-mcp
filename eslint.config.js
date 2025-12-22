import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ESLint 配置文件
 * 
 * 使用 ESLint 9.x Flat Config 格式
 * 参考：https://eslint.org/docs/head/use/configure/configuration-files
 */

// ===== 文件路径配置 =====
const SOURCE_FILES = ['src/**/*.ts', 'types/**/*.ts'];
const TEST_FILES = ['tests/**/*.ts', 'scripts/**/*.ts'];

// ===== Parser 配置 =====
const typeCheckedParserOptions = {
    project: true,
    tsconfigRootDir: __dirname,
};

const noTypeCheckParserOptions = {
    project: false,
};

// ===== 规则配置 =====
const typescriptRules = {
    // 类型安全规则
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
            allowHigherOrderFunctions: true,
        },
    ],
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
        },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
};

const codeQualityRules = {
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-throw-literal': 'error',
};

const codeStyleRules = {
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
};

const testFileRules = {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
        },
    ],
    'no-console': 'off',
};

// ===== 忽略文件配置 =====
const ignores = [
    'dist/**',
    'node_modules/**',
    '*.config.js',
    '*.config.ts',
    'screenshots/**',
    'pnpm-lock.yaml',
    'CHANGELOG.md',
    '*.md',
    'vitest.config.ts',
    'tsup.config.ts',
];

// ===== 构建配置 =====
const typescriptTypeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: SOURCE_FILES,
    languageOptions: {
        ...config.languageOptions,
        parserOptions: {
            ...config.languageOptions?.parserOptions,
            ...typeCheckedParserOptions,
        },
    },
}));

const testConfigs = tseslint.configs.recommended.map((config) => ({
    ...config,
    files: TEST_FILES,
}));

export default defineConfig(
    // 基础 ESLint 推荐配置
    eslint.configs.recommended,

    // TypeScript ESLint 推荐配置（包含类型检查）
    ...typescriptTypeCheckedConfigs,

    // 源代码文件配置
    {
        files: SOURCE_FILES,
        languageOptions: {
            parserOptions: typeCheckedParserOptions,
        },
        rules: {
            ...typescriptRules,
            ...codeQualityRules,
            ...codeStyleRules,
        },
    },

    // 测试文件和脚本文件配置
    ...testConfigs,
    {
        files: TEST_FILES,
        languageOptions: {
            parserOptions: noTypeCheckParserOptions,
        },
        rules: testFileRules,
    },

    // 全局忽略配置
    {
        ignores,
    },
);
