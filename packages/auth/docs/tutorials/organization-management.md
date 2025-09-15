# Organization Management Tutorial

This tutorial provides comprehensive guidance on implementing multi-tenant organization management using the @repo/auth package. You'll learn to create, manage, and secure organizations with teams, member invitations, and role-based access control.

## Table of Contents

1. [Organization Concepts](#organization-concepts)
2. [Creating Organizations](#creating-organizations)
3. [Member Management](#member-management)
4. [Team Management](#team-management)
5. [Role & Permission Management](#role--permission-management)
6. [Organization Settings](#organization-settings)
7. [Invitation System](#invitation-system)
8. [Active Organization Context](#active-organization-context)

## Organization Concepts

### Multi-tenancy Architecture

The @repo/auth package implements a robust multi-tenant architecture where:

- **Organizations** are the primary tenant boundaries
- **Users** can belong to multiple organizations with different roles
- **Teams** provide sub-organization groupings (up to 10 per organization)
- **Active Organization** determines the current working context
- **Permissions** are scoped to organizations

### Organization Hierarchy

```
Organization (Tenant)
├── Members (Users with roles)
├── Teams (Sub-groups, max 10)
│   └── Team Members
├── Custom Roles
├── Settings & Configuration
└── Resources (Audit logs, reports, etc.)
```

## Creating Organizations

### Basic Organization Creation

```typescript path=/src/lib/organization.ts start=null
import { db } from '@repo/auth'
import { organization, member, activeOrganization } from '@repo/auth'
import type { Session } from '@repo/auth'

export interface CreateOrganizationInput {
  name: string
  slug?: string
  retentionDays?: number
  logo?: string
}

export async function createOrganization(
  session: Session,
  input: CreateOrganizationInput
): Promise<typeof organization.$inferSelect> {
  const organizationId = crypto.randomUUID()
  const userId = session.user.id
  
  try {
    // Start transaction
    return await db.transaction(async (tx) => {
      // Create organization
      const [newOrg] = await tx.insert(organization).values({
        id: organizationId,
        name: input.name,
        slug: input.slug || input.name.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
        retentionDays: input.retentionDays || 90,
        logo: input.logo || null,
        createdAt: new Date(),
        metadata: null
      }).returning()

      // Add creator as organization owner
      await tx.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: newOrg.id,
        userId: userId,
        role: 'owner',
        createdAt: new Date()
      })

      // Set as active organization if user has no active org
      const existingActive = await tx.query.activeOrganization.findFirst({
        where: (active, { eq }) => eq(active.userId, userId)
      })

      if (!existingActive) {
        await tx.insert(activeOrganization).values({
          userId: userId,
          organizationId: newOrg.id,
          role: 'owner'
        })
      }

      return newOrg
    })
  } catch (error) {
    console.error('Failed to create organization:', error)
    throw new Error('Organization creation failed')
  }
}
```

### Organization Validation

```typescript path=/src/lib/organization-validation.ts start=null
import { db } from '@repo/auth'
import { organization } from '@repo/auth'
import { eq } from 'drizzle-orm'

export class OrganizationValidation {
  /**
   * Validate organization name
   */
  static validateName(name: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!name || name.trim().length === 0) {
      errors.push('Organization name is required')
    }
    
    if (name.length < 2) {
      errors.push('Organization name must be at least 2 characters')
    }
    
    if (name.length > 100) {
      errors.push('Organization name must be less than 100 characters')
    }
    
    // Check for valid characters
    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(name)) {
      errors.push('Organization name contains invalid characters')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate and generate unique slug
   */
  static async validateSlug(slug: string, excludeOrgId?: string): Promise<{
    valid: boolean
    errors: string[]
    suggestion?: string
  }> {
    const errors: string[] = []
    
    // Basic slug validation
    if (slug.length < 2) {
      errors.push('Organization slug must be at least 2 characters')
    }
    
    if (slug.length > 50) {
      errors.push('Organization slug must be less than 50 characters')
    }
    
    if (!/^[a-z0-9-]+$/.test(slug)) {
      errors.push('Slug can only contain lowercase letters, numbers, and hyphens')
    }
    
    if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.push('Slug cannot start or end with a hyphen')
    }
    
    // Check for reserved slugs
    const reserved = ['api', 'admin', 'www', 'mail', 'ftp', 'auth', 'app']
    if (reserved.includes(slug)) {
      errors.push('This slug is reserved and cannot be used')
    }
    
    // Check uniqueness
    try {
      const existing = await db.query.organization.findFirst({
        where: (orgs, { eq, and, ne }) => 
          excludeOrgId 
            ? and(eq(orgs.slug, slug), ne(orgs.id, excludeOrgId))
            : eq(orgs.slug, slug)
      })
      
      if (existing) {
        errors.push('This slug is already taken')
        
        // Generate suggestion
        const suggestion = await this.generateUniqueSlug(slug)
        
        return {
          valid: false,
          errors,
          suggestion
        }
      }
    } catch (error) {
      console.error('Slug validation error:', error)
      errors.push('Unable to validate slug uniqueness')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate unique slug
   */
  static async generateUniqueSlug(baseSlug: string): Promise<string> {
    let counter = 1
    let candidateSlug = baseSlug
    
    while (counter < 100) { // Prevent infinite loops
      const existing = await db.query.organization.findFirst({
        where: eq(organization.slug, candidateSlug)
      })
      
      if (!existing) {
        return candidateSlug
      }
      
      candidateSlug = `${baseSlug}-${counter}`
      counter++
    }
    
    // Fallback to random string
    return `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`
  }
}
```

## Member Management

### Adding Members

```typescript path=/src/lib/member-management.ts start=null
import { db, authz } from '@repo/auth'
import { member, invitation, user } from '@repo/auth'
import { eq, and } from 'drizzle-orm'
import type { Session } from '@repo/auth'

export interface InviteMemberInput {
  email: string
  role: 'member' | 'admin' | 'owner'
  teamId?: string
  message?: string
}

export class MemberManagement {
  /**
   * Invite a new member to organization
   */
  static async inviteMember(
    session: Session,
    organizationId: string,
    input: InviteMemberInput
  ): Promise<void> {
    // Check permissions
    const canInvite = await authz.hasPermission(
      session,
      'organization.members',
      'invite'
    )
    
    if (!canInvite) {
      throw new Error('Insufficient permissions to invite members')
    }
    
    // Validate role hierarchy
    const currentUserRole = session.session.activeOrganizationRole!
    if (!this.canAssignRole(currentUserRole, input.role)) {
      throw new Error('Cannot assign higher role than your own')
    }
    
    try {
      await db.transaction(async (tx) => {
        // Check if user already exists
        const existingUser = await tx.query.user.findFirst({
          where: eq(user.email, input.email)
        })
        
        if (existingUser) {
          // Check if already a member
          const existingMember = await tx.query.member.findFirst({
            where: and(
              eq(member.userId, existingUser.id),
              eq(member.organizationId, organizationId)
            )
          })
          
          if (existingMember) {
            throw new Error('User is already a member of this organization')
          }
        }
        
        // Create invitation
        const invitationId = crypto.randomUUID()
        await tx.insert(invitation).values({
          id: invitationId,
          organizationId,
          email: input.email,
          role: input.role,
          teamId: input.teamId || null,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          inviterId: session.user.id
        })
        
        // Better Auth will handle sending the invitation email
        // through the configured sendInvitationEmail function
      })
    } catch (error) {
      console.error('Failed to invite member:', error)
      throw error
    }
  }

  /**
   * Accept invitation and create membership
   */
  static async acceptInvitation(
    invitationId: string,
    userId: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // Get invitation
        const invite = await tx.query.invitation.findFirst({
          where: eq(invitation.id, invitationId),
          with: {
            organization: true
          }
        })
        
        if (!invite) {
          throw new Error('Invitation not found')
        }
        
        if (invite.status !== 'pending') {
          throw new Error('Invitation has already been processed')
        }
        
        if (invite.expiresAt < new Date()) {
          throw new Error('Invitation has expired')
        }
        
        // Create membership
        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: invite.organizationId,
          userId: userId,
          role: invite.role,
          createdAt: new Date()
        })
        
        // Add to team if specified
        if (invite.teamId) {
          const { teamMember } = await import('@repo/auth')
          await tx.insert(teamMember).values({
            id: crypto.randomUUID(),
            teamId: invite.teamId,
            userId: userId,
            createdAt: new Date()
          })
        }
        
        // Update invitation status
        await tx.update(invitation)
          .set({ status: 'accepted' })
          .where(eq(invitation.id, invitationId))
        
        // Set as active organization if user has none
        const { activeOrganization } = await import('@repo/auth')
        const existingActive = await tx.query.activeOrganization.findFirst({
          where: eq(activeOrganization.userId, userId)
        })
        
        if (!existingActive) {
          await tx.insert(activeOrganization).values({
            userId: userId,
            organizationId: invite.organizationId,
            role: invite.role
          })
        }
      })
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      throw error
    }
  }

  /**
   * Remove member from organization
   */
  static async removeMember(
    session: Session,
    organizationId: string,
    userId: string
  ): Promise<void> {
    // Check permissions
    const canRemove = await authz.hasPermission(
      session,
      'organization.members',
      'remove'
    )
    
    if (!canRemove) {
      throw new Error('Insufficient permissions to remove members')
    }
    
    // Prevent self-removal if owner
    if (userId === session.user.id && session.session.activeOrganizationRole === 'owner') {
      throw new Error('Organization owners cannot remove themselves')
    }
    
    try {
      await db.transaction(async (tx) => {
        // Get member info
        const memberInfo = await tx.query.member.findFirst({
          where: and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId)
          )
        })
        
        if (!memberInfo) {
          throw new Error('Member not found')
        }
        
        // Check role hierarchy
        const currentUserRole = session.session.activeOrganizationRole!
        if (!this.canManageRole(currentUserRole, memberInfo.role)) {
          throw new Error('Cannot remove member with equal or higher role')
        }
        
        // Remove from teams
        const { teamMember } = await import('@repo/auth')
        await tx.delete(teamMember)
          .where(eq(teamMember.userId, userId))
        
        // Remove membership
        await tx.delete(member)
          .where(and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId)
          ))
        
        // Clear active organization if it was active
        const { activeOrganization } = await import('@repo/auth')
        await tx.delete(activeOrganization)
          .where(and(
            eq(activeOrganization.userId, userId),
            eq(activeOrganization.organizationId, organizationId)
          ))
        
        // Clear permission cache
        await authz.clearUserCache(userId)
      })
    } catch (error) {
      console.error('Failed to remove member:', error)
      throw error
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    session: Session,
    organizationId: string,
    userId: string,
    newRole: string
  ): Promise<void> {
    // Check permissions
    const canUpdate = await authz.hasPermission(
      session,
      'organization.members',
      'update'
    )
    
    if (!canUpdate) {
      throw new Error('Insufficient permissions to update member roles')
    }
    
    const currentUserRole = session.session.activeOrganizationRole!
    
    // Validate role assignment
    if (!this.canAssignRole(currentUserRole, newRole)) {
      throw new Error('Cannot assign higher role than your own')
    }
    
    try {
      await db.transaction(async (tx) => {
        // Get current member
        const currentMember = await tx.query.member.findFirst({
          where: and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId)
          )
        })
        
        if (!currentMember) {
          throw new Error('Member not found')
        }
        
        // Check if can manage current role
        if (!this.canManageRole(currentUserRole, currentMember.role)) {
          throw new Error('Cannot modify member with equal or higher role')
        }
        
        // Update role
        await tx.update(member)
          .set({ role: newRole })
          .where(and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId)
          ))
        
        // Update active organization role if applicable
        const { activeOrganization } = await import('@repo/auth')
        await tx.update(activeOrganization)
          .set({ role: newRole })
          .where(and(
            eq(activeOrganization.userId, userId),
            eq(activeOrganization.organizationId, organizationId)
          ))
        
        // Clear permission cache
        await authz.clearUserCache(userId)
      })
    } catch (error) {
      console.error('Failed to update member role:', error)
      throw error
    }
  }

  /**
   * Check if current role can assign target role
   */
  private static canAssignRole(currentRole: string, targetRole: string): boolean {
    const hierarchy = {
      'owner': 3,
      'admin': 2,
      'member': 1
    }
    
    const currentLevel = hierarchy[currentRole as keyof typeof hierarchy] || 0
    const targetLevel = hierarchy[targetRole as keyof typeof hierarchy] || 0
    
    return currentLevel > targetLevel
  }

  /**
   * Check if current role can manage target role
   */
  private static canManageRole(currentRole: string, targetRole: string): boolean {
    const hierarchy = {
      'owner': 3,
      'admin': 2,
      'member': 1
    }
    
    const currentLevel = hierarchy[currentRole as keyof typeof hierarchy] || 0
    const targetLevel = hierarchy[targetRole as keyof typeof hierarchy] || 0
    
    return currentLevel > targetLevel
  }

  /**
   * Get organization members with pagination
   */
  static async getMembers(
    organizationId: string,
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit
    
    try {
      const members = await db.query.member.findMany({
        where: eq(member.organizationId, organizationId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
              createdAt: true,
              emailVerified: true
            }
          }
        },
        limit,
        offset,
        orderBy: (members, { asc }) => [asc(members.createdAt)]
      })
      
      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(member)
        .where(eq(member.organizationId, organizationId))
      
      return {
        members,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    } catch (error) {
      console.error('Failed to get members:', error)
      throw error
    }
  }
}
```

## Team Management

### Creating and Managing Teams

```typescript path=/src/lib/team-management.ts start=null
import { db, authz } from '@repo/auth'
import { team, teamMember, member } from '@repo/auth'
import { eq, and, sql } from 'drizzle-orm'
import type { Session } from '@repo/auth'

export interface CreateTeamInput {
  name: string
  description?: string
}

export class TeamManagement {
  /**
   * Create a new team
   */
  static async createTeam(
    session: Session,
    organizationId: string,
    input: CreateTeamInput
  ): Promise<typeof team.$inferSelect> {
    // Check permissions (org admin or owner)
    const canManageTeams = session.session.activeOrganizationRole === 'owner' ||
                          session.session.activeOrganizationRole === 'admin'
    
    if (!canManageTeams) {
      throw new Error('Only organization admins and owners can create teams')
    }
    
    try {
      return await db.transaction(async (tx) => {
        // Check team limit (max 10 teams per organization)
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(team)
          .where(eq(team.organizationId, organizationId))
        
        if (count >= 10) {
          throw new Error('Maximum number of teams (10) reached for this organization')
        }
        
        // Check team name uniqueness within organization
        const existingTeam = await tx.query.team.findFirst({
          where: and(
            eq(team.organizationId, organizationId),
            eq(team.name, input.name)
          )
        })
        
        if (existingTeam) {
          throw new Error('Team name already exists in this organization')
        }
        
        // Create team
        const [newTeam] = await tx.insert(team).values({
          id: crypto.randomUUID(),
          name: input.name,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()
        
        return newTeam
      })
    } catch (error) {
      console.error('Failed to create team:', error)
      throw error
    }
  }

  /**
   * Add member to team
   */
  static async addTeamMember(
    session: Session,
    teamId: string,
    userId: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // Get team info
        const teamInfo = await tx.query.team.findFirst({
          where: eq(team.id, teamId)
        })
        
        if (!teamInfo) {
          throw new Error('Team not found')
        }
        
        // Check if user is member of organization
        const orgMember = await tx.query.member.findFirst({
          where: and(
            eq(member.userId, userId),
            eq(member.organizationId, teamInfo.organizationId)
          )
        })
        
        if (!orgMember) {
          throw new Error('User is not a member of this organization')
        }
        
        // Check if already in team
        const existingTeamMember = await tx.query.teamMember.findFirst({
          where: and(
            eq(teamMember.teamId, teamId),
            eq(teamMember.userId, userId)
          )
        })
        
        if (existingTeamMember) {
          throw new Error('User is already a member of this team')
        }
        
        // Add to team
        await tx.insert(teamMember).values({
          id: crypto.randomUUID(),
          teamId,
          userId,
          createdAt: new Date()
        })
      })
    } catch (error) {
      console.error('Failed to add team member:', error)
      throw error
    }
  }

  /**
   * Remove member from team
   */
  static async removeTeamMember(
    session: Session,
    teamId: string,
    userId: string
  ): Promise<void> {
    try {
      const result = await db.delete(teamMember)
        .where(and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, userId)
        ))
        .returning()
      
      if (result.length === 0) {
        throw new Error('Team member not found')
      }
    } catch (error) {
      console.error('Failed to remove team member:', error)
      throw error
    }
  }

  /**
   * Get team members
   */
  static async getTeamMembers(teamId: string) {
    try {
      const members = await db.query.teamMember.findMany({
        where: eq(teamMember.teamId, teamId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        }
      })
      
      return members
    } catch (error) {
      console.error('Failed to get team members:', error)
      throw error
    }
  }

  /**
   * Get organization teams
   */
  static async getOrganizationTeams(organizationId: string) {
    try {
      const teams = await db.query.team.findMany({
        where: eq(team.organizationId, organizationId),
        with: {
          _count: {
            teamMembers: true
          }
        },
        orderBy: (teams, { asc }) => [asc(teams.createdAt)]
      })
      
      return teams
    } catch (error) {
      console.error('Failed to get organization teams:', error)
      throw error
    }
  }
}
```

## Active Organization Context

### Managing Active Organization

```typescript path=/src/lib/active-organization.ts start=null
import { db } from '@repo/auth'
import { activeOrganization, member } from '@repo/auth'
import { eq, and } from 'drizzle-orm'
import type { Session } from '@repo/auth'

export class ActiveOrganizationManager {
  /**
   * Switch user's active organization
   */
  static async switchOrganization(
    userId: string,
    organizationId: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // Verify user is member of target organization
        const membership = await tx.query.member.findFirst({
          where: and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId)
          )
        })
        
        if (!membership) {
          throw new Error('User is not a member of this organization')
        }
        
        // Update or insert active organization
        await tx.insert(activeOrganization).values({
          userId,
          organizationId,
          role: membership.role
        }).onConflictDoUpdate({
          target: activeOrganization.userId,
          set: {
            organizationId,
            role: membership.role
          }
        })
      })
    } catch (error) {
      console.error('Failed to switch organization:', error)
      throw error
    }
  }

  /**
   * Get user's organizations with active status
   */
  static async getUserOrganizations(userId: string) {
    try {
      const memberships = await db.query.member.findMany({
        where: eq(member.userId, userId),
        with: {
          organization: true
        }
      })
      
      const active = await db.query.activeOrganization.findFirst({
        where: eq(activeOrganization.userId, userId)
      })
      
      return memberships.map(membership => ({
        ...membership.organization,
        role: membership.role,
        isActive: active?.organizationId === membership.organizationId,
        joinedAt: membership.createdAt
      }))
    } catch (error) {
      console.error('Failed to get user organizations:', error)
      throw error
    }
  }

  /**
   * Clear active organization (useful for organization deletion)
   */
  static async clearActiveOrganization(
    userId: string,
    organizationId: string
  ): Promise<void> {
    try {
      await db.delete(activeOrganization)
        .where(and(
          eq(activeOrganization.userId, userId),
          eq(activeOrganization.organizationId, organizationId)
        ))
    } catch (error) {
      console.error('Failed to clear active organization:', error)
      throw error
    }
  }
}
```

## Complete Organization API Implementation

### Organization Routes

```typescript path=/src/routes/organizations.ts start=null
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  requireAuth,
  requireOrganization,
  requirePermission,
  requireRole
} from '@/middleware/auth'
import {
  createOrganization,
  MemberManagement,
  TeamManagement,
  ActiveOrganizationManager,
  OrganizationValidation
} from '@/lib/organization'
import { PERMISSIONS } from '@repo/auth'

const app = new Hono()

// Validation schemas
const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).optional(),
  retentionDays: z.number().min(1).max(3650).optional()
})

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']),
  teamId: z.string().optional(),
  message: z.string().optional()
})

// Create organization
app.post('/',
  requireAuth,
  zValidator('json', createOrgSchema),
  async (c) => {
    const session = c.get('session')
    const data = c.req.valid('json')
    
    // Validate name
    const nameValidation = OrganizationValidation.validateName(data.name)
    if (!nameValidation.valid) {
      return c.json({
        error: 'Invalid organization name',
        details: nameValidation.errors
      }, 400)
    }
    
    // Validate slug if provided
    if (data.slug) {
      const slugValidation = await OrganizationValidation.validateSlug(data.slug)
      if (!slugValidation.valid) {
        return c.json({
          error: 'Invalid organization slug',
          details: slugValidation.errors,
          suggestion: slugValidation.suggestion
        }, 400)
      }
    }
    
    try {
      const organization = await createOrganization(session, data)
      return c.json({ organization }, 201)
    } catch (error) {
      return c.json({
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

// List user's organizations
app.get('/my',
  requireAuth,
  async (c) => {
    const session = c.get('session')
    
    try {
      const organizations = await ActiveOrganizationManager.getUserOrganizations(
        session.user.id
      )
      return c.json({ organizations })
    } catch (error) {
      return c.json({
        error: 'Failed to fetch organizations',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

// Switch active organization
app.post('/switch/:orgId',
  requireAuth,
  async (c) => {
    const session = c.get('session')
    const orgId = c.req.param('orgId')
    
    try {
      await ActiveOrganizationManager.switchOrganization(session.user.id, orgId)
      return c.json({ message: 'Organization switched successfully' })
    } catch (error) {
      return c.json({
        error: 'Failed to switch organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 400)
    }
  }
)

// Get organization members
app.get('/:orgId/members',
  requireAuth,
  requirePermission(
    PERMISSIONS.ORGANIZATION.MEMBERS.READ.resource,
    PERMISSIONS.ORGANIZATION.MEMBERS.READ.action
  ),
  async (c) => {
    const orgId = c.req.param('orgId')
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    
    try {
      const result = await MemberManagement.getMembers(orgId, page, limit)
      return c.json(result)
    } catch (error) {
      return c.json({
        error: 'Failed to fetch members',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

// Invite member
app.post('/:orgId/members/invite',
  requireAuth,
  requirePermission(
    PERMISSIONS.ORGANIZATION.MEMBERS.INVITE.resource,
    PERMISSIONS.ORGANIZATION.MEMBERS.INVITE.action
  ),
  zValidator('json', inviteMemberSchema),
  async (c) => {
    const session = c.get('session')
    const orgId = c.req.param('orgId')
    const data = c.req.valid('json')
    
    try {
      await MemberManagement.inviteMember(session, orgId, data)
      return c.json({ message: 'Invitation sent successfully' })
    } catch (error) {
      return c.json({
        error: 'Failed to send invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 400)
    }
  }
)

// Remove member
app.delete('/:orgId/members/:userId',
  requireAuth,
  requirePermission(
    PERMISSIONS.ORGANIZATION.MEMBERS.REMOVE.resource,
    PERMISSIONS.ORGANIZATION.MEMBERS.REMOVE.action
  ),
  async (c) => {
    const session = c.get('session')
    const orgId = c.req.param('orgId')
    const userId = c.req.param('userId')
    
    try {
      await MemberManagement.removeMember(session, orgId, userId)
      return c.json({ message: 'Member removed successfully' })
    } catch (error) {
      return c.json({
        error: 'Failed to remove member',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 400)
    }
  }
)

// Get organization teams
app.get('/:orgId/teams',
  requireAuth,
  requireOrganization,
  async (c) => {
    const orgId = c.req.param('orgId')
    
    try {
      const teams = await TeamManagement.getOrganizationTeams(orgId)
      return c.json({ teams })
    } catch (error) {
      return c.json({
        error: 'Failed to fetch teams',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

// Create team
app.post('/:orgId/teams',
  requireAuth,
  requireRole('admin'), // Admins and owners can create teams
  zValidator('json', z.object({
    name: z.string().min(2).max(50)
  })),
  async (c) => {
    const session = c.get('session')
    const orgId = c.req.param('orgId')
    const { name } = c.req.valid('json')
    
    try {
      const team = await TeamManagement.createTeam(session, orgId, { name })
      return c.json({ team }, 201)
    } catch (error) {
      return c.json({
        error: 'Failed to create team',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 400)
    }
  }
)

export default app
```

This comprehensive organization management tutorial provides technical users with detailed examples and patterns for implementing multi-tenant organization features using the @repo/auth package. The code covers organization creation, member management, team features, role management, and complete API implementations.