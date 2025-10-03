# Alert Management FAQ

## Frequently Asked Questions

### Getting Started

#### Q: How do I access the alert management system?

**A:** Log into your account and navigate to the "Alerts" section in the main navigation menu. You need appropriate permissions to view and manage alerts.

#### Q: What browsers are supported?

**A:** The alert system supports modern browsers including:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Internet Explorer is not supported.

#### Q: Can I use the system on mobile devices?

**A:** Yes! The interface is fully responsive and optimized for mobile devices including phones and tablets. All features are available on mobile with touch-friendly interactions.

### Understanding Alerts

#### Q: What do the different alert severity levels mean?

**A:** Alert severity levels indicate the urgency and impact:

- **Critical** - System failure or security breach (immediate response required)
- **High** - Significant operational impact (respond within 1 hour)
- **Medium** - Moderate impact or degraded performance (respond within 4 hours)
- **Low** - Minor issues (respond within 24 hours)
- **Info** - General notifications (respond as needed)

#### Q: What's the difference between alert types?

**A:** Alert types categorize the source or nature of the alert:

- **System** - Infrastructure and system-level alerts
- **Security** - Security-related incidents and threats
- **Performance** - Performance degradation and bottlenecks
- **Compliance** - Regulatory and compliance violations
- **Custom** - Organization-specific alert types

#### Q: How are alert statuses different?

**A:** Alert statuses track the lifecycle of an alert:

- **Active** - New alert requiring attention
- **Acknowledged** - Someone is aware and working on it
- **Resolved** - Issue has been fixed
- **Dismissed** - Alert doesn't require action

### Working with Alerts

#### Q: What's the difference between acknowledging and resolving an alert?

**A:**

- **Acknowledging** means you're aware of the alert and are working on it. The alert remains open but shows someone is handling it.
- **Resolving** means the underlying issue has been fixed and the alert can be closed. You must provide resolution notes explaining what was done.

#### Q: Can I undo alert actions?

**A:** Some actions can be undone:

- **Acknowledged alerts** can be returned to active status
- **Resolved alerts** can be reopened if the issue recurs
- **Dismissed alerts** cannot be easily recovered (contact support if needed)

#### Q: How do I handle false positive alerts?

**A:**

1. Dismiss the alert with a note explaining it's a false positive
2. Document the reason in the resolution notes
3. Work with your administrator to adjust alert rules to reduce future false positives
4. Consider creating filters to automatically handle similar cases

#### Q: Can multiple people work on the same alert?

**A:** Yes, the system tracks who acknowledges and resolves alerts. You can see if someone else is already working on an alert by checking the "Acknowledged By" field.

### Filtering and Search

#### Q: How do I save frequently used filters?

**A:**

1. Set up your desired filters
2. Click "Save Filter" in the filter panel
3. Give your filter a descriptive name
4. Access saved filters from the filter dropdown menu

#### Q: What can I search for in the search box?

**A:** The search function looks through:

- Alert titles
- Alert descriptions
- Source system names
- Tags
- Resolution notes (for resolved alerts)

#### Q: How do I clear all filters?

**A:** Click the "Clear Filters" button in the filter panel, or use the "Reset" option in the filter dropdown menu.

### Notifications

#### Q: Why am I not receiving notifications?

**A:** Check these common issues:

1. Browser notifications may be blocked - check browser settings
2. Notification preferences may be disabled in your profile settings
3. Email notifications may be going to spam folder
4. You may be in "quiet hours" if configured

#### Q: How do I customize notification settings?

**A:**

1. Click the Settings button in the alert dashboard
2. Navigate to the Notifications section
3. Configure your preferences for email, browser, and mobile notifications
4. Set quiet hours if you don't want notifications during certain times

#### Q: What's the red number on the notification bell?

**A:** The red badge shows the count of unread alert notifications. Click the bell to view and mark notifications as read.

### Performance and Technical Issues

#### Q: The alert list is loading slowly. What can I do?

**A:** Try these solutions:

1. Use more specific filters to reduce the data load
2. Close other browser tabs to free up memory
3. Clear your browser cache and cookies
4. Disable browser extensions temporarily
5. Try using a different browser

#### Q: Alerts aren't updating in real-time. What's wrong?

**A:** This could be due to:

1. Network connectivity issues - check your internet connection
2. WebSocket connection problems - try refreshing the page
3. Browser blocking WebSocket connections - check security settings
4. Server maintenance - check with your administrator

#### Q: I'm getting permission errors. What should I do?

**A:**

1. Verify you have the appropriate role and permissions
2. Contact your administrator to request access
3. Try logging out and logging back in
4. Clear your browser session data

### Data and Reporting

#### Q: How long are alerts stored in the system?

**A:** Alert retention varies by organization but is typically 90 days for active alerts and 1 year for resolved alerts. Check with your administrator for your specific retention policy.

#### Q: Can I export alert data?

**A:** Yes, you can export alerts in several formats:

- CSV for spreadsheet analysis
- PDF for reports and documentation
- JSON for technical analysis
  Use the Export button in the toolbar or statistics view.

#### Q: Is there an API for accessing alert data?

**A:** Yes, there's a REST API available for developers. Contact your administrator for API documentation, authentication details, and access permissions.

### Mobile Usage

#### Q: Are all features available on mobile?

**A:** Yes, all alert management features are available on mobile devices with touch-optimized interfaces. Some features may be reorganized for better mobile usability.

#### Q: How do I perform bulk operations on mobile?

**A:**

1. Use the select checkboxes to choose multiple alerts
2. Tap the bulk actions button that appears
3. Choose your desired action from the menu
4. Confirm the operation

#### Q: Can I use keyboard shortcuts on mobile?

**A:** Keyboard shortcuts work on mobile devices with external keyboards. Touch gestures replace some shortcuts on touchscreen devices.

### Troubleshooting

#### Q: The page is blank or won't load. What should I try?

**A:** Follow these steps:

1. Refresh the page (pull down on mobile)
2. Clear browser cache and cookies
3. Try an incognito/private browsing window
4. Disable browser extensions
5. Try a different browser
6. Contact support if the issue persists

#### Q: I can see alerts but can't perform actions on them. Why?

**A:** This usually indicates a permissions issue:

1. Check that you have the appropriate role
2. Verify your account hasn't been restricted
3. Contact your administrator for permission review
4. Try logging out and back in

#### Q: The statistics view isn't showing data. What's wrong?

**A:** Possible causes:

1. No alerts match your current filters
2. Date range is set too narrowly
3. Statistics are still loading (wait a moment)
4. Data permissions may be restricted
5. Try clearing filters and refreshing

### Integration and Workflow

#### Q: Can I integrate alerts with other tools?

**A:** Integration options depend on your organization's setup:

- Email notifications can forward to ticketing systems
- API access allows custom integrations
- Webhook support may be available for real-time updates
- Contact your administrator about available integrations

#### Q: How do I set up team workflows for alert handling?

**A:** Consider these best practices:

1. Define clear ownership for different alert types
2. Create shared saved filters for team areas
3. Establish escalation procedures for unacknowledged alerts
4. Use consistent resolution note formats
5. Regular team reviews of alert trends

#### Q: Can I create custom alert rules?

**A:** Alert rule creation is typically handled by administrators or through separate monitoring tools. Contact your administrator about creating custom rules for your specific needs.

### Account and Access

#### Q: I forgot my password. How do I reset it?

**A:** Use the "Forgot Password" link on the login page, or contact your administrator if you're using single sign-on (SSO).

#### Q: My account is locked. What should I do?

**A:** Contact your system administrator to unlock your account. Account locks usually occur after multiple failed login attempts.

#### Q: How do I change my notification preferences?

**A:**

1. Access your profile settings from the user menu
2. Navigate to the Notifications section
3. Update your email, browser, and mobile notification preferences
4. Save your changes

### Getting Help

#### Q: Where can I get additional help?

**A:** Several support options are available:

1. Check this FAQ for common questions
2. Use the help button (?) in the interface
3. Contact your system administrator
4. Submit a support ticket through the help menu
5. Access the user guide for detailed instructions

#### Q: How do I report bugs or request features?

**A:**

1. Use the feedback form in the help menu
2. Contact your administrator to submit requests
3. Document the issue with screenshots if possible
4. Include browser and device information

#### Q: Is training available for new users?

**A:** Training options vary by organization:

- Self-service user guide and documentation
- Video tutorials (if available)
- Administrator-led training sessions
- Hands-on practice in a test environment
  Contact your administrator about available training resources.

---

## Still Need Help?

If you can't find the answer to your question in this FAQ:

1. **Check the User Guide** for detailed step-by-step instructions
2. **Contact Support** through the help menu in the application
3. **Reach out to your Administrator** for organization-specific questions
4. **Submit Feedback** to help us improve the system and documentation

We're continuously updating this FAQ based on user questions and feedback. If you have suggestions for additional questions to include, please let us know!
