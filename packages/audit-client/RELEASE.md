# Release Documentation

This document outlines the release process, versioning strategy, and publishing guidelines for the @smedrec/audit-client package.

## Release Process

### 1. Pre-Release Checklist

Before creating a release, ensure the following items are completed:

- [ ] All tests pass (`pnpm test`)
- [ ] Type checking passes (`pnpm check-types`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Package validation passes (`pnpm release:dry`)
- [ ] Documentation is up to date
- [ ] CHANGELOG.md is updated with new changes
- [ ] Version number follows semantic versioning

### 2. Version Strategy

We follow [Semantic Versioning (SemVer)](https://semver.org/) for all releases:

- **MAJOR** (X.0.0): Breaking changes that require user code modifications
- **MINOR** (0.X.0): New features that are backward compatible
- **PATCH** (0.0.X): Bug fixes and improvements that are backward compatible

#### Version Examples

```bash
# Patch release (bug fixes)
1.0.0 → 1.0.1

# Minor release (new features)
1.0.1 → 1.1.0

# Major release (breaking changes)
1.1.0 → 2.0.0

# Pre-release versions
1.0.0 → 1.1.0-beta.1 → 1.1.0-beta.2 → 1.1.0
```

### 3. Release Types

#### Stable Releases

- Published to the `latest` npm tag
- Fully tested and documented
- Recommended for production use

#### Pre-releases

- Published to the `beta` or `alpha` npm tag
- For testing new features before stable release
- Not recommended for production use

#### Patch Releases

- Critical bug fixes
- Security updates
- Performance improvements

### 4. Automated Release Process

#### Using GitHub Actions (Recommended)

1. **Trigger Release Workflow**:

   ```bash
   # Go to GitHub Actions → Audit Client Release → Run workflow
   # Select version and release type
   ```

2. **Manual Release Process**:

   ```bash
   # 1. Update version
   cd packages/audit-client
   npm version patch|minor|major

   # 2. Update changelog
   # Edit CHANGELOG.md manually

   # 3. Build and test
   pnpm build
   pnpm test
   pnpm release:dry

   # 4. Commit and tag
   git add .
   git commit -m "chore(audit-client): release vX.X.X"
   git tag vX.X.X

   # 5. Push changes
   git push origin main --tags

   # 6. Create GitHub release (triggers npm publish)
   gh release create vX.X.X --generate-notes
   ```

### 5. Release Validation

#### Automated Checks

- ✅ TypeScript compilation
- ✅ Unit tests pass
- ✅ Integration tests pass
- ✅ Linting passes
- ✅ Package builds successfully
- ✅ Cross-platform compatibility
- ✅ Bundle size analysis

#### Manual Verification

- [ ] Install package in test project
- [ ] Verify all exports work correctly
- [ ] Test in different environments (Node.js, browser, React Native)
- [ ] Validate TypeScript definitions
- [ ] Check documentation accuracy

### 6. Post-Release Tasks

#### Immediate (Automated)

- ✅ Package published to npm
- ✅ GitHub release created
- ✅ Release notes generated
- ✅ Artifacts uploaded

#### Manual Follow-up

- [ ] Update dependent packages
- [ ] Announce release in relevant channels
- [ ] Update documentation site
- [ ] Monitor for issues or feedback

### 7. Rollback Procedure

If a release has critical issues:

#### For Latest Release

```bash
# 1. Unpublish problematic version (within 24 hours)
npm unpublish @smedrec/audit-client@X.X.X

# 2. Or deprecate the version
npm deprecate @smedrec/audit-client@X.X.X "Critical issue - use vX.X.Y instead"
```

#### For Older Releases

```bash
# Deprecate the problematic version
npm deprecate @smedrec/audit-client@X.X.X "Security vulnerability - upgrade to vX.X.Y"
```

### 8. Release Channels

#### NPM Tags

- `latest`: Stable releases (default)
- `beta`: Beta releases for testing
- `alpha`: Alpha releases for early testing
- `next`: Next major version previews

#### Publishing to Different Tags

```bash
# Publish to beta tag
npm publish --tag beta

# Publish to latest (default)
npm publish

# Move beta to latest
npm dist-tag add @smedrec/audit-client@X.X.X latest
```

### 9. Security Releases

For security-related releases:

1. **Coordinate with security team**
2. **Prepare patch for all supported versions**
3. **Use expedited release process**
4. **Notify users through security advisories**

#### Security Release Example

```bash
# Create security patch
git checkout v1.0.0
git cherry-pick <security-fix-commit>
npm version patch
git tag v1.0.1-security

# Publish immediately
npm publish
```

### 10. Release Metrics

Track the following metrics for each release:

- **Download Statistics**: Monitor npm download counts
- **Issue Reports**: Track post-release bug reports
- **Performance Impact**: Monitor bundle size and performance
- **Adoption Rate**: Track version adoption across users

### 11. Communication

#### Release Announcements

- GitHub Releases with detailed changelog
- npm package page updates
- Documentation site updates
- Community notifications (if applicable)

#### Release Notes Template

```markdown
## @smedrec/audit-client vX.X.X

### 🚀 New Features

- Feature descriptions

### 🐛 Bug Fixes

- Bug fix descriptions

### 📚 Documentation

- Documentation updates

### ⚠️ Breaking Changes

- Breaking change descriptions (major versions only)

### 📦 Installation

\`\`\`bash
npm install @smedrec/audit-client@X.X.X
\`\`\`
```

## Troubleshooting

### Common Release Issues

#### Build Failures

- Check TypeScript compilation errors
- Verify all dependencies are installed
- Ensure clean build environment

#### Test Failures

- Run tests locally first
- Check for environment-specific issues
- Verify test data and mocks

#### Publishing Failures

- Verify npm authentication
- Check package.json configuration
- Ensure version doesn't already exist

#### Version Conflicts

- Check existing versions on npm
- Verify git tags are correct
- Ensure changelog is updated

### Getting Help

For release-related issues:

1. Check this documentation
2. Review GitHub Actions logs
3. Contact the maintainers
4. Create an issue in the repository
