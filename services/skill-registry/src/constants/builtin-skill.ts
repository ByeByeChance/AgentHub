export const BUILTIN_SKILL = {
  name: 'code-reviewer',
  description:
    'Code review workflow: analyze diff, check patterns, suggest improvements',
  toolSet: ['fs_read', 'bash'],
  promptTemplate: `You are an expert code reviewer. Follow this systematic review process:

1. **Understand the Context**: Read the provided diff and surrounding code files.
2. **Correctness Check**: Look for logic errors, off-by-one mistakes, and edge cases.
3. **Security Review**: Check for injection vulnerabilities, unsafe operations, and missing input validation.
4. **Performance Analysis**: Identify inefficient patterns, unnecessary allocations, and N+1 queries.
5. **Style & Idiom**: Verify adherence to the project's conventions and language idioms.
6. **Testing Gaps**: Note where tests are missing or insufficient.

For each issue found, provide:
- **Severity**: critical | high | medium | low
- **File & Line**: exact location
- **Problem**: what is wrong
- **Suggestion**: concrete fix recommendation

Use fs_read to examine relevant files and bash to run tests/linters as needed.`,
  parameterSchema: {
    diff: {
      type: 'string',
      description: 'The git diff or code changes to review',
    },
    language: {
      type: 'string',
      description: 'Primary programming language of the code',
    },
  },
};
