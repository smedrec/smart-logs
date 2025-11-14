# Compliance Reports User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Creating Scheduled Reports](#creating-scheduled-reports)
5. [Managing Reports](#managing-reports)
6. [Viewing Execution History](#viewing-execution-history)
7. [Manual Report Execution](#manual-report-execution)
8. [Delivery Destinations](#delivery-destinations)
9. [Report Templates](#report-templates)
10. [Troubleshooting](#troubleshooting)

## Introduction

The Compliance Reports system provides a comprehensive interface for managing healthcare compliance reporting within the SMEDREC platform. This guide will help you understand how to create, manage, and monitor compliance reports including HIPAA, GDPR, and custom regulatory reports.

### Key Features

- **Automated Scheduling**: Schedule reports to run automatically at specified intervals
- **Multiple Report Types**: Support for HIPAA, GDPR, and custom compliance reports
- **Flexible Delivery**: Configure multiple delivery destinations including email, webhooks, and file storage
- **Execution Monitoring**: Track report execution status and view detailed history
- **Manual Execution**: Trigger reports on-demand for immediate compliance needs
- **Template System**: Create and reuse report templates for common configurations

## Getting Started

### Accessing the Compliance Dashboard

1. Log in to the SMEDREC platform
2. Navigate to the **Compliance** section from the main sidebar
3. The Compliance Dashboard will display an overview of your reports and system status

### User Roles and Permissions

- **Compliance Officer**: Full access to create, edit, and manage all compliance reports
- **Administrator**: Full access plus system configuration capabilities
- **Auditor**: Read-only access to view reports and execution history
- **Developer**: Access to API integration and technical configuration

## Dashboard Overview

The Compliance Dashboard provides a quick overview of your compliance reporting system:

### Dashboard Components

#### Statistics Panel

- **Total Reports**: Number of active scheduled reports
- **Success Rate**: Percentage of successful executions
- **Failed Executions**: Count of recent failures requiring attention
- **Upcoming Reports**: Next scheduled report executions

#### Recent Executions

- View the most recent report executions
- Status indicators (Success, Failed, Running)
- Quick access to execution details

#### Upcoming Reports

- See which reports are scheduled to run next
- Countdown timers for next execution
- Quick action buttons for manual execution

#### System Health

- Audit system connectivity status
- API response times
- System performance metrics

### Quick Actions

From the dashboard, you can:

- **Create Report**: Start creating a new scheduled report
- **View All Reports**: Navigate to the full reports list
- **View Execution History**: See detailed execution logs
- **Manage Destinations**: Configure delivery destinations

## Creating Scheduled Reports

### Step 1: Basic Information

1. Click **Create Report** from the dashboard or reports list
2. Enter the following information:
   - **Report Name**: A descriptive name for your report
   - **Description**: Optional details about the report's purpose
   - **Report Type**: Select HIPAA, GDPR, or Custom

### Step 2: Configure Criteria

Based on your selected report type, configure the following:

#### HIPAA Reports

- **Date Range**: Specify the time period for audit events
- **Event Types**: Select which HIPAA-relevant events to include
- **User Filters**: Filter by specific users or roles
- **Resource Filters**: Filter by specific resources or data types

#### GDPR Reports

- **Data Subject**: Specify data subject identifiers
- **Processing Activities**: Select relevant processing activities
- **Legal Basis**: Filter by legal basis for processing
- **Data Categories**: Select personal data categories

#### Custom Reports

- **Query Builder**: Use the visual query builder to define custom criteria
- **Field Selection**: Choose which fields to include in the report
- **Aggregations**: Configure grouping and aggregation options

### Step 3: Schedule Configuration

Configure when and how often the report should run:

1. **Frequency**: Select from:
   - Daily
   - Weekly
   - Monthly
   - Custom (using cron expressions)

2. **Time**: Specify the execution time (in your timezone)

3. **Timezone**: Select the appropriate timezone

4. **Next Execution Preview**: Review when the report will next run

### Step 4: Delivery Configuration

Configure where and how report results should be delivered:

1. **Select Delivery Destinations**: Choose from configured destinations
2. **Add New Destination**: Create a new delivery destination if needed
3. **Format Options**: Select output format (PDF, CSV, JSON)
4. **Notification Settings**: Configure success/failure notifications

### Step 5: Review and Create

1. Review the configuration summary
2. Click **Create Report** to save
3. The report will be scheduled and appear in your reports list

## Managing Reports

### Viewing All Reports

Navigate to **Compliance > Scheduled Reports** to see all your reports.

### Reports List Features

- **Search**: Find reports by name or description
- **Filter**: Filter by report type, status, or schedule frequency
- **Sort**: Sort by name, creation date, or last execution
- **Bulk Actions**: Select multiple reports for bulk operations

### Editing a Report

1. Click on a report in the list
2. Click **Edit** from the report details page
3. Modify any configuration settings
4. Click **Save Changes**

### Enabling/Disabling Reports

- Use the toggle switch in the reports list to enable or disable a report
- Disabled reports will not execute on their schedule
- You can still manually execute disabled reports

### Deleting Reports

1. Select the report(s) you want to delete
2. Click **Delete** from the actions menu
3. Confirm the deletion
4. **Note**: Execution history will be preserved

## Viewing Execution History

### Accessing Execution History

1. Navigate to **Compliance > Execution History**
2. Or click on a specific report and view its execution history

### Execution History Features

#### Status Indicators

- **Success**: Report completed successfully
- **Failed**: Report execution failed (see error details)
- **Running**: Report is currently executing
- **Cancelled**: Report execution was cancelled

#### Filtering Options

- **Date Range**: Filter by execution date
- **Status**: Filter by execution status
- **Report Type**: Filter by report type

#### Execution Details

Click on any execution to view:

- Execution start and end times
- Duration
- Number of records processed
- File size and format
- Error messages (if failed)
- Download links for results

### Downloading Reports

1. Navigate to the execution you want to download
2. Click the **Download** button
3. Select your preferred format (PDF, CSV, JSON)
4. The file will download to your device

## Manual Report Execution

### When to Use Manual Execution

- Immediate compliance needs
- Ad-hoc audits or investigations
- Testing report configurations
- Generating reports outside the regular schedule

### Executing a Report Manually

1. Navigate to the report you want to execute
2. Click **Execute Now**
3. Review the execution parameters
4. Click **Confirm Execution**
5. Monitor the execution progress in real-time

### Monitoring Execution Progress

- View real-time progress updates
- See estimated completion time
- Cancel execution if needed
- Receive notification when complete

## Delivery Destinations

### Managing Delivery Destinations

Navigate to **Compliance > Delivery Destinations** to manage where reports are delivered.

### Destination Types

#### Email Delivery

- Configure SMTP settings or use API-based email
- Specify recipient addresses
- Customize email subject and body
- Attach reports in specified formats

#### Webhook Delivery

- Configure webhook URL
- Set custom headers
- Configure retry settings
- Verify webhook endpoint

#### Storage Delivery

- Local file system
- Amazon S3
- Azure Blob Storage
- Google Cloud Storage

#### SFTP Delivery

- Configure SFTP connection details
- Specify remote path
- Set file permissions
- Configure authentication

### Testing Destinations

1. Navigate to a delivery destination
2. Click **Test Connection**
3. Review test results
4. Fix any configuration issues

### Destination Health Monitoring

- View destination health status
- See delivery success rates
- Monitor for failures
- Receive alerts for degraded destinations

## Report Templates

### Using Templates

Templates allow you to quickly create reports based on common configurations.

### Creating a Template

1. Create a report with your desired configuration
2. Click **Save as Template**
3. Give the template a name and description
4. The template is now available for reuse

### Using a Template

1. Click **Create Report**
2. Select **Use Template**
3. Choose your template
4. Modify any settings as needed
5. Save the new report

### Managing Templates

- View all templates in **Compliance > Report Templates**
- Edit template configurations
- Delete unused templates
- Share templates with team members

## Troubleshooting

### Common Issues

#### Report Execution Failures

**Problem**: Report fails to execute

**Solutions**:

1. Check system health status on the dashboard
2. Verify audit system connectivity
3. Review error messages in execution details
4. Check date range and criteria configuration
5. Ensure sufficient system resources

#### Delivery Failures

**Problem**: Reports not being delivered

**Solutions**:

1. Test delivery destination connection
2. Verify destination configuration
3. Check network connectivity
4. Review delivery logs for errors
5. Verify authentication credentials

#### Performance Issues

**Problem**: Reports taking too long to execute

**Solutions**:

1. Reduce date range for large datasets
2. Optimize criteria and filters
3. Schedule reports during off-peak hours
4. Consider breaking large reports into smaller ones
5. Contact support for performance optimization

### Getting Help

If you encounter issues not covered in this guide:

1. Check the **System Health** panel for connectivity issues
2. Review execution logs for detailed error messages
3. Contact your system administrator
4. Reach out to SMEDREC support with:
   - Error ID from the error message
   - Report configuration details
   - Execution history
   - Screenshots of the issue

### Support Resources

- **Documentation**: [SMEDREC Documentation](https://docs.smedrec.com)
- **API Reference**: [API Documentation](https://api.smedrec.com/docs)
- **Support Email**: support@smedrec.com
- **Community Forum**: [SMEDREC Community](https://community.smedrec.com)

## Best Practices

### Report Configuration

1. **Use descriptive names**: Make it easy to identify reports at a glance
2. **Add detailed descriptions**: Document the purpose and scope of each report
3. **Test before scheduling**: Use manual execution to verify configuration
4. **Start with narrow criteria**: Expand criteria gradually to avoid performance issues
5. **Use templates**: Create templates for common report types

### Scheduling

1. **Schedule during off-peak hours**: Reduce impact on system performance
2. **Stagger report schedules**: Avoid running multiple large reports simultaneously
3. **Consider timezone differences**: Schedule reports for appropriate business hours
4. **Review schedules regularly**: Adjust schedules based on business needs

### Delivery

1. **Configure multiple destinations**: Ensure redundancy for critical reports
2. **Test destinations regularly**: Verify delivery configurations are working
3. **Monitor delivery health**: Address failures promptly
4. **Use appropriate formats**: Choose formats based on recipient needs

### Monitoring

1. **Review execution history regularly**: Identify patterns and issues
2. **Set up notifications**: Get alerted to failures immediately
3. **Monitor system health**: Address connectivity issues proactively
4. **Track success rates**: Identify reports that need optimization

## Keyboard Shortcuts

The compliance interface supports keyboard shortcuts for efficient navigation:

- **Ctrl/Cmd + K**: Open command palette
- **Ctrl/Cmd + N**: Create new report
- **Ctrl/Cmd + F**: Focus search
- **Ctrl/Cmd + R**: Refresh current view
- **?**: Show keyboard shortcuts help

## Accessibility Features

The compliance interface is designed to be accessible to all users:

- **Keyboard Navigation**: Full keyboard support for all features
- **Screen Reader Support**: Proper ARIA labels and semantic markup
- **High Contrast Mode**: Support for high contrast themes
- **Focus Indicators**: Clear visual focus indicators
- **Skip Links**: Quick navigation to main content areas

## Conclusion

This guide covers the essential features of the Compliance Reports system. For more detailed information about specific features or advanced configurations, please refer to the developer documentation or contact support.

Remember to regularly review your compliance reporting setup to ensure it meets your organization's evolving regulatory requirements.
