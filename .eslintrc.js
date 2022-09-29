module.exports = {
    "parser": "@typescript-eslint/parser",
    "extends": ['airbnb-typescript'],
    "parserOptions": {
    "project": ["./tsconfig.json"]
    },
    "plugins": [
    "promise",
    "@typescript-eslint",
    "import",
    "simple-import-sort",
    "testing-library"
    ],
    "env": {
    "node": true,
    "jest": true,
    },
    "globals": {
    "__DEV__": "readonly",
    "__TEST__": "readonly",
    "__PROD__": "readonly",
    "$": "writable",
    },
    "rules": {
        "linebreak-style": [
            "error",
            "unix"
        ],
        "constructor-super": [
            "error"
        ],
        "no-var": [
            "error"
        ],
        "no-useless-constructor": 0,
        "no-mixed-spaces-and-tabs": [
            "error"
        ],
        "brace-style": [
            "error"
        ],
        "spaced-comment": 0,
        "no-trailing-spaces": 0,
        "key-spacing": 0,
        "max-len": "off",
        "object-curly-spacing": [
            2,
            "always"
        ],
        "eol-last": 2,
        "unicode-bom": "off",
        "padded-blocks": "off",
        "no-unused-vars": [
            "error",
            {
            "args": "after-used",
            "ignoreRestSiblings": true,
            "argsIgnorePattern": "^(_|(args|props|event|e)$)",
            "varsIgnorePattern": "^_"
            }
        ],
        "no-multiple-empty-lines": "off",
        "no-underscore-dangle": "off",
        "no-restricted-imports": [
            "error",
            {
            "patterns": [
                "components/examples/*",
                "components/display/Glyph",
                "enzyme"
            ]
            }
        ],
        "no-restricted-globals": [
            "error",
            "location"
        ],
        "no-throw-literal": "off",
        "camelcase": [
            "error",
            {
            "allow": [
                "data-testid"
            ]
            }
        ],
        "eqeqeq": [
            "error",
            "smart"
        ],
        "arrow-body-style": "off",
        "function-call-argument-newline": "off",
        "lines-between-class-members": "off",
        "prefer-arrow-callback": [
            "error",
            {
            "allowNamedFunctions": true,
            "allowUnboundThis": false
            }
        ],
        "sort-imports": "off",
        "import/first": "error",
        "import/newline-after-import": "error",
        "import/no-duplicates": "error",
        "simple-import-sort/imports": [
            "error",
            {
            "groups": [
                [
                "^\\u0000"
                ],
                [
                "^@?\\w"
                ],
                [
                "^components/"
                ],
                [
                "^models/"
                ],
                [
                "^util/"
                ],
                [
                "^\\."
                ],
                [
                "^\\u0000.*\\.s?css$"
                ]
            ]
            }
        ],
        "simple-import-sort/exports": "error",
        "testing-library/consistent-data-testid": [
            "error",
            {
            "testIdPattern": "([a-z][a-z\\-]*)+[a-z]",
            "testIdAttribute": [
                "data-testid"
            ]
            }
        ],
        "@typescript-eslint/consistent-type-assertions": [
            "error",
            {
            "assertionStyle": "as",
            "objectLiteralTypeAssertions": "allow"
            }
        ]
    },
    "overrides": [
        {
            "files": [
            "*.spec.*"
            ]
        },
        {
            "files": [
            "*.ts",
            ],
            "rules": {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                "args": "after-used",
                "ignoreRestSiblings": true,
                "argsIgnorePattern": "^(_|(args|props|event|e)$)",
                "varsIgnorePattern": "^_"
                }
            ],
            "semi": "off",
            "@typescript-eslint/semi": [
                "error"
            ]
            }
        },
        {
            "files": [
            "*.js",
            ],
            "rules": {
            "no-unused-vars": [
                "error",
                {
                "args": "after-used",
                "ignoreRestSiblings": true,
                "argsIgnorePattern": "^(_|(args|props|event|e)$)",
                "varsIgnorePattern": "^_"
                }
            ]
            }
        },
        {
            "files": [
            "*.ts",
            ],
            "rules": {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                "args": "after-used",
                "ignoreRestSiblings": true,
                "argsIgnorePattern": "^(_|(args|props|event|e)$)",
                "varsIgnorePattern": "^_"
                }
            ]
            }
        }
    ]
  };