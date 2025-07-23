const { ProjectBudget, Tag } = require('../../models');
const logger = require('../../utils/logger');

class ProjectBudgetService {
  // ============================================
  // PROJECT BUDGET OPERATIONS
  // ============================================

  /**
   * Create a new project budget
   */
  async createProjectBudget(userId, projectData) {
    try {
      const project = new ProjectBudget({
        userId,
        name: projectData.name,
        description: projectData.description || '',
        startDate: projectData.startDate,
        endDate: projectData.endDate,
        fundingSources: projectData.fundingSources || [],
        categoryBudgets: projectData.categoryBudgets || [],
        currency: projectData.currency || 'ILS',
        priority: projectData.priority || 'medium',
        notes: projectData.notes || ''
      });

      await project.save();

      // Create project tag
      await project.createProjectTag();

      logger.info(`Created project budget for user ${userId}: ${projectData.name}`);
      return project;
    } catch (error) {
      logger.error('Error creating project budget:', error);
      throw error;
    }
  }

  /**
   * Get project budget details
   */
  async getProjectBudget(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId)
        .populate('projectTag', 'name')
        .populate('categoryBudgets.categoryId', 'name type')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project budget not found');
      }

      return project;
    } catch (error) {
      logger.error('Error fetching project budget:', error);
      throw error;
    }
  }

  /**
   * Update project budget
   */
  async updateProjectBudget(projectId, updates) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      const allowedUpdates = ['name', 'description', 'endDate', 'status', 'fundingSources', 'categoryBudgets', 'priority', 'notes'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          project[field] = updates[field];
        }
      });

      await project.save();
      logger.info(`Updated project budget: ${projectId}`);
      
      return project;
    } catch (error) {
      logger.error('Error updating project budget:', error);
      throw error;
    }
  }

  /**
   * Delete project budget
   */
  async deleteProjectBudget(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      // Remove project tag if it exists
      if (project.projectTag) {
        await Tag.findByIdAndDelete(project.projectTag);
      }

      await ProjectBudget.findByIdAndDelete(projectId);
      logger.info(`Deleted project budget: ${projectId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting project budget:', error);
      throw error;
    }
  }

  /**
   * Get project progress
   */
  async getProjectProgress(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId)
        .populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project not found');
      }

      await project.updateActualAmounts();
      return project.getProjectOverview();
    } catch (error) {
      logger.error('Error getting project progress:', error);
      throw error;
    }
  }

  /**
   * Get all project budgets for a user with filtering
   */
  async getProjectBudgets(userId, filters = {}) {
    try {
      const query = { userId };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.year) {
        query.$or = [
          { startDate: { $gte: new Date(filters.year, 0, 1), $lte: new Date(filters.year, 11, 31) } },
          { endDate: { $gte: new Date(filters.year, 0, 1), $lte: new Date(filters.year, 11, 31) } }
        ];
      }

      const projects = await ProjectBudget.find(query)
        .populate('projectTag', 'name')
        .populate('categoryBudgets.categoryId', 'name type')
        .populate('categoryBudgets.subCategoryId', 'name')
        .sort({ startDate: -1 });

      // Update actual amounts for each project
      for (const project of projects) {
        await project.updateActualAmounts();
      }

      return {
        projects,
        total: projects.length
      };
    } catch (error) {
      logger.error('Error getting project budgets:', error);
      throw error;
    }
  }

  /**
   * Get active project budgets for a user
   */
  async getActiveProjectBudgets(userId) {
    try {
      const activeProjects = await ProjectBudget.findActive(userId);

      // Update actual amounts for each project
      for (const project of activeProjects) {
        await project.updateActualAmounts();
      }

      return activeProjects;
    } catch (error) {
      logger.error('Error getting active project budgets:', error);
      throw error;
    }
  }

  /**
   * Get upcoming project budgets for a user
   */
  async getUpcomingProjectBudgets(userId, daysAhead = 30) {
    try {
      const upcomingProjects = await ProjectBudget.findUpcoming(userId, daysAhead);

      return upcomingProjects;
    } catch (error) {
      logger.error('Error getting upcoming project budgets:', error);
      throw error;
    }
  }

  /**
   * Get project budgets for a specific year
   */
  async getProjectBudgetsForYear(userId, year) {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      const projects = await ProjectBudget.find({
        userId,
        $or: [
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } },
          { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
        ]
      })
      .populate('projectTag', 'name')
      .populate('categoryBudgets.categoryId', 'name type')
      .populate('categoryBudgets.subCategoryId', 'name')
      .sort({ startDate: -1 });

      // Update actual amounts for each project
      for (const project of projects) {
        await project.updateActualAmounts();
      }

      return projects;
    } catch (error) {
      logger.error('Error getting project budgets for year:', error);
      throw error;
    }
  }

  /**
   * Mark project as completed
   */
  async markProjectCompleted(projectId, completionNotes = '') {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      project.status = 'completed';
      project.completedDate = new Date();
      if (completionNotes) {
        project.notes = (project.notes || '') + '\n\nCompletion Notes: ' + completionNotes;
      }

      await project.save();
      logger.info(`Marked project budget as completed: ${projectId}`);
      
      return project;
    } catch (error) {
      logger.error('Error marking project as completed:', error);
      throw error;
    }
  }

  /**
   * Get project budget statistics for dashboard
   */
  async getProjectBudgetStats(userId) {
    try {
      const [activeProjects, upcomingProjects, completedProjects] = await Promise.all([
        this.getActiveProjectBudgets(userId),
        this.getUpcomingProjectBudgets(userId, 30),
        ProjectBudget.find({ userId, status: 'completed' })
      ]);

      const totalActiveProjectBudget = activeProjects.reduce((sum, p) => sum + p.totalBudget, 0);
      const totalSpentOnActiveProjects = activeProjects.reduce((sum, p) => sum + p.totalActualAmount, 0);

      return {
        activeProjects: activeProjects.length,
        upcomingProjects: upcomingProjects.length,
        completedProjects: completedProjects.length,
        totalActiveProjectBudget,
        totalSpentOnActiveProjects,
        averageProjectProgress: activeProjects.length > 0 
          ? activeProjects.reduce((sum, p) => sum + p.progressPercentage, 0) / activeProjects.length 
          : 0
      };
    } catch (error) {
      logger.error('Error getting project budget statistics:', error);
      throw error;
    }
  }
}

module.exports = new ProjectBudgetService();
