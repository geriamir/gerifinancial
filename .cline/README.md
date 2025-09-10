# Cline Rules for GeriFinancial Backend

This directory contains Cline rules to enforce coding standards and architectural patterns for the GeriFinancial backend project.

## Available Rules

### 📦 Import Standards (`import-standards.clinerule`)

Enforces proper import patterns across backend subsystems to maintain clean architecture:

- **Internal imports**: Use direct imports within the same subsystem
- **External imports**: Use main subsystem index files for cross-subsystem imports  
- **Index file purity**: Subsystem indexes only export their own items
- **Encapsulation**: Proper subsystem boundary enforcement

**When to reference**: Any time you're working with imports in backend services, routes, or models.

## How to Use

Cline will automatically reference these rules when working in the backend. You can also explicitly reference them by mentioning the rule name in your requests.

## Adding New Rules

When adding new Cline rules:
1. Create a `.clinerule` file with a descriptive name
2. Update this README with a brief description
3. Include examples of correct and incorrect patterns
4. Add enforcement guidelines
