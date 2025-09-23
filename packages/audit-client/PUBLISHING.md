# Publishing Checklist

This document provides a comprehensive checklist for publishing the @smedrec/audit-client package to npm.

## Pre-Publishing Checklist

### 🔍 Code Quality

- [ ] All tests pass (`pnpm test`)
- [ ] Test coverage is adequate (`pnpm test:coverage`)
- [ ] Type checking passes (`pnpm check-types`)
- [ ] Linting passes (`pnpm lint`)
- [ ] No TypeScript errors or warnings
- [ ] Code follows project conventions

### 📦 Package Validation

- [ ] Package builds successfully (`pnpm build`)
- [ ] Package validation passes (`pnpm validate:package`)
- [ ] Environment tests pass (`pnpm test:environments`)
- [ ] Full validation passes (`pnpm validate:full`)
- [ ] Dry run publish works (`pnpm release:dry`)

### 📚 Documentation

- [ ] README.md is up to date
- [ ] CHANGELOG.md includes new changes
- [ ] API documentation is current
- [ ] Examples are working and tested
- [ ] Migration guide is updated (if needed)

### 🏷️ Version Management

- [ ] Version number follows semantic versioning
- [ ] Version is updated in package.json
- [ ] Git tag matches package version
- [ ] CHANGELOG.md reflects the new version

### 🔐 Security & Legal

- [ ] No sensitive information in code
- [ ] Dependencies are up to date
- [ ] Security audit passes (`npm audit`)
- [ ] License file is included
- [ ] Copyright notices are correct

## Publishing Process

### 1. Automated Publishing (Recommended)

#### Using GitHub Actions Release Workflow

1. **Trigger Release Workflow**:

   ```bash
   # Go to GitHub Actions → Audit Client Release → Run workflow
   # Fill in the required information:
   # - Version: e.g., 1.0.0, 1.1.0, 2.0.0
   # - Release Type: patch, minor, major, prerelease
   # - Prerelease: true/false
   ```

2. **Monitor Workflow**:
   - Watch the workflow execution in GitHub Actions
   - Verify all tests pass
   - Check that the package builds correctly
   - Ensure validation steps complete successfully

3. **Verify Publication**:
   - Check that the GitHub release is created
   - Verify the package appears on npm
   - Test installation from npm registry

#### Using CI/CD Pipeline

The package will be automatically published when:

- A GitHub release is created
- The release workflow completes successfully
- All validation checks pass

### 2. Manual Publishing

#### Step-by-Step Manual Process

1. **Prepare Release**:

   ```bash
   cd packages/audit-client

   # Update version
   npm version patch|minor|major

   # Update changelog
   # Edit CHANGELOG.md manually
   ```

2. **Validate Package**:

   ```bash
   # Run full validation
   pnpm validate:full

   # Test dry run
   pnpm release:dry
   ```

3. **Commit Changes**:

   ```bash
   git add .
   git commit -m "chore(audit-client): release vX.X.X"
   git tag vX.X.X
   git push origin main --tags
   ```

4. **Publish to npm**:

   ```bash
   # Login to npm (if not already logged in)
   npm login

   # Publish package
   pnpm release
   ```

5. **Create GitHub Release**:

   ```bash
   # Using GitHub CLI
   gh release create vX.X.X --generate-notes

   # Or create manually on GitHub web interface
   ```

## Post-Publishing Checklist

### ✅ Verification

- [ ] Package appears on npm registry
- [ ] Package can be installed (`npm install @smedrec/audit-client`)
- [ ] Package works in test project
- [ ] Documentation site is updated
- [ ] GitHub release is created with proper notes

### 📢 Communication

- [ ] Release announcement (if applicable)
- [ ] Update dependent projects
- [ ] Notify team members
- [ ] Update project documentation

### 📊 Monitoring

- [ ] Monitor npm download statistics
- [ ] Watch for bug reports or issues
- [ ] Check community feedback
- [ ] Monitor performance metrics

## Troubleshooting

### Common Publishing Issues

#### Authentication Errors

```bash
# Check npm authentication
npm whoami

# Login if needed
npm login

# Verify access to package
npm access list packages
```

#### Version Conflicts

```bash
# Check existing versions
npm view @smedrec/audit-client versions --json

# Ensure version doesn't already exist
npm view @smedrec/audit-client@X.X.X
```

#### Build Failures

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build

# Check for TypeScript errors
pnpm check-types
```

#### Test Failures

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test suites
pnpm test:coverage
pnpm test:environments
```

### Rollback Procedure

If a published version has critical issues:

#### Within 24 Hours (Unpublish)

```bash
# Unpublish the problematic version
npm unpublish @smedrec/audit-client@X.X.X

# Publish a fixed version
npm version patch
pnpm release
```

#### After 24 Hours (Deprecate)

```bash
# Deprecate the problematic version
npm deprecate @smedrec/audit-client@X.X.X "Critical issue - use vX.X.Y instead"

# Publish a fixed version
npm version patch
pnpm release
```

## Release Types

### Patch Release (X.X.1)

- Bug fixes
- Security patches
- Performance improvements
- Documentation updates

**Example**: 1.0.0 → 1.0.1

### Minor Release (X.1.0)

- New features (backward compatible)
- New APIs
- Enhanced functionality
- Deprecation warnings

**Example**: 1.0.1 → 1.1.0

### Major Release (2.0.0)

- Breaking changes
- API changes
- Removed deprecated features
- Architecture changes

**Example**: 1.1.0 → 2.0.0

### Pre-release (X.X.X-beta.1)

- Beta versions for testing
- Release candidates
- Alpha versions for early feedback

**Example**: 1.0.0 → 1.1.0-beta.1 → 1.1.0

## npm Tags

### Default Tags

- `latest`: Stable releases (default installation)
- `beta`: Beta releases for testing
- `alpha`: Alpha releases for early testing
- `next`: Next major version previews

### Publishing to Specific Tags

```bash
# Publish to beta tag
npm publish --tag beta

# Publish to latest (default)
npm publish

# Move tag to different version
npm dist-tag add @smedrec/audit-client@X.X.X latest
```

## Security Considerations

### Before Publishing

- [ ] Run security audit: `npm audit`
- [ ] Check for vulnerable dependencies
- [ ] Verify no secrets in code
- [ ] Ensure proper access controls

### npm Security

- [ ] Use 2FA on npm account
- [ ] Verify package ownership
- [ ] Check collaborator access
- [ ] Monitor security advisories

## Quality Gates

All of the following must pass before publishing:

1. **Automated Tests**: Unit, integration, and environment tests
2. **Type Checking**: TypeScript compilation without errors
3. **Linting**: Code style and quality checks
4. **Build Validation**: Successful package build
5. **Package Validation**: Package structure and exports
6. **Security Audit**: No known vulnerabilities
7. **Documentation**: Up-to-date and accurate docs

## Support and Maintenance

### Version Support Policy

- **Latest Major**: Full support and active development
- **Previous Major**: Security updates and critical bug fixes
- **Older Versions**: Security updates only (limited time)

### Maintenance Schedule

- **Patch Releases**: As needed for bugs and security
- **Minor Releases**: Monthly or quarterly
- **Major Releases**: Annually or as needed for breaking changes

## Getting Help

If you encounter issues during publishing:

1. **Check Documentation**: Review this checklist and release docs
2. **Search Issues**: Look for similar problems on GitHub
3. **Contact Maintainers**: Reach out to package maintainers
4. **Create Issue**: Report problems with detailed information

## Automation

### GitHub Actions Workflows

- **CI/CD Pipeline**: `.github/workflows/audit-client-ci.yml`
- **Release Workflow**: `.github/workflows/audit-client-release.yml`

### npm Scripts

- `pnpm validate:full`: Complete validation
- `pnpm release:dry`: Test publishing
- `pnpm release`: Publish to npm

### Validation Scripts

- `scripts/validate-package.js`: Package validation
- `scripts/test-environments.js`: Environment testing
