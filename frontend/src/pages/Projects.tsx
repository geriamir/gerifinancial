import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Container, 
  Button, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  IconButton,
  Card,
  CardContent,
  Alert,
  Chip,
  Paper
} from '@mui/material';
import { 
  ArrowBack, 
  Add, 
  Delete,
  Edit,
  Save,
  Cancel
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ProjectBudgetsList from '../components/budget/ProjectBudgetsList';
import ProjectOverviewVisualization from '../components/budget/ProjectOverviewVisualization';
import ProjectExpensesList from '../components/budget/ProjectExpensesList';
import { getBudgetStatus } from '../utils/budgetUtils';
import { updatePlannedExpense, deletePlannedExpense, addPlannedExpense } from '../utils/projectHelpers';
import { useProject } from '../contexts/ProjectContext';
import { FundingSource } from '../types/projects';
import { SUPPORTED_CURRENCIES, formatCurrency, getCurrencySymbol } from '../types/foreignCurrency';
import { categoriesApi } from '../services/api/categories';
import { budgetsApi } from '../services/api/budgets';

const FUNDING_SOURCE_TYPES = [
  { value: 'ongoing_funds', label: 'Ongoing Funds' },
  { value: 'loan', label: 'Loan' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' }
];

const Projects: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, loading, updateProject } = useProject();
  const navigate = useNavigate();
  
  // Editing state management - only one item can be edited at a time
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [editingFunding, setEditingFunding] = useState<number | null>(null);
  const [editingBudgetItem, setEditingBudgetItem] = useState<number | null>(null);
  
  // Local state for editing values to prevent save-on-every-keystroke
  const [editingValues, setEditingValues] = useState<any>({});
  
  // Categories state
  const [categories, setCategories] = useState<Array<{
    _id: string;
    name: string;
    type: 'Income' | 'Expense' | 'Transfer';
    subCategories: Array<{
      _id: string;
      name: string;
      keywords: string[];
    }>;
  }>>([]);
  const [, setCategoriesLoading] = useState(false);
  const [, setTravelCategory] = useState<{
    _id: string;
    name: string;
    type: 'Income' | 'Expense' | 'Transfer';
    subCategories: Array<{
      _id: string;
      name: string;
      keywords: string[];
    }>;
  } | null>(null);

  // Load categories when component mounts
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        console.log('Loading categories for vacation project...'); // Debug log
        const userCategories = await categoriesApi.getUserCategories();
        console.log('Categories loaded:', userCategories); // Debug log
        setCategories(userCategories);
        
        // Find Travel category for vacation projects
        const travelCat = userCategories.find(cat => 
          cat.name.toLowerCase().includes('travel') || 
          cat.name.toLowerCase().includes('vacation') ||
          cat.name.toLowerCase().includes('trip')
        );
        
        if (travelCat) {
          console.log('Found travel category:', travelCat);
          setTravelCategory(travelCat);
        } else {
          console.log('No travel category found in:', userCategories.map(c => c.name));
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Helper functions for editing state
  const isEditing = (field: string) => editingFields.has(field);
  const startEditing = (field: string) => setEditingFields(prev => new Set(prev).add(field));
  const stopEditing = (field: string) => setEditingFields(prev => {
    const newSet = new Set(prev);
    newSet.delete(field);
    return newSet;
  });
  const handleSave = (field: string) => stopEditing(field);

  // If projectId is provided, find and show the specific project
  if (projectId) {
    const specificProject = projects.find(project => project._id === projectId);
    
    if (loading && !specificProject) {
      return (
        <Container maxWidth="lg">
          <Box py={3}>
            <Typography variant="h4" component="h1" gutterBottom>
              Loading Project...
            </Typography>
          </Box>
        </Container>
      );
    }

    if (!specificProject) {
      return (
        <Container maxWidth="lg">
          <Box py={3}>
            <Typography variant="h4" component="h1" gutterBottom>
              Project Not Found
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              The project you're looking for doesn't exist or you don't have access to it.
            </Typography>
          </Box>
        </Container>
      );
    }

    // Helper functions for local editing values (moved after null checks)
    const startEditingFunding = (index: number) => {
      const source = (specificProject.fundingSources || [])[index];
      
      const newEditingValues = {
        ...editingValues,
        [`funding_${index}`]: { 
          ...source,
          currency: source.currency || specificProject.currency || 'ILS'
        }
      };
      setEditingValues(newEditingValues);
      setEditingFunding(index);
    };

    const saveFunding = (index: number) => {
      const editedSource = editingValues[`funding_${index}`];
      if (editedSource) {
        const updated = [...(specificProject.fundingSources || [])];
        
        // Check if this is a new funding source (index beyond current array)
        if (index >= (specificProject.fundingSources?.length || 0)) {
          // This is a new funding source - add it to the array
          updated.push(editedSource);
        } else {
          // This is an existing funding source - update it
          updated[index] = editedSource;
        }
        updateProject(specificProject._id, { fundingSources: updated });
      }
      setEditingFunding(null);
    };

    const cancelEditingFunding = (index: number) => {
      const newEditingValues = { ...editingValues };
      delete newEditingValues[`funding_${index}`];
      setEditingValues(newEditingValues);
      setEditingFunding(null);
    };

    const updateEditingValue = (key: string, field: string, value: any) => {
      
      const newEditingValues = {
        ...editingValues,
        [key]: {
          ...editingValues[key],
          [field]: value
        }
      };
      
      setEditingValues(newEditingValues);
    };

    // Helper function for unplanned expenses management
    const handleRemoveExpenseFromProject = async (transactionId: string) => {
      try {
        await budgetsApi.removeTransactionFromProject(specificProject._id, transactionId);
        
        // Refresh the project data to reflect changes
        // The useProject context will handle refetching the updated project data
      } catch (error) {
        console.error('Failed to remove expense from project:', error);
      }
    };


    return (
      <Container maxWidth="lg">
        <Box py={3}>
          {/* Navigation */}
          <Box display="flex" justifyContent="flex-start" alignItems="center" mb={2}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/projects')}
              variant="outlined"
            >
              Back to Projects
            </Button>
          </Box>
          
          {/* Project Header */}
          <Paper sx={{ p: 3, mb: 3 }}>
            {/* Project Header - Combined Title and Metadata Editing */}
            {isEditing('header') ? (
              <Box mb={3}>
                {/* Project Title - Editing */}
                <Box display="flex" alignItems="center" mb={3} gap={1}>
                  <TextField
                    fullWidth
                    variant="standard"
                    value={specificProject.name || ''}
                    onChange={(e) => updateProject(specificProject._id, { name: e.target.value })}
                    sx={{ 
                      '& .MuiInput-root': {
                        fontSize: '2rem',
                        fontWeight: 'bold'
                      }
                    }}
                    placeholder="Project name..."
                    autoFocus
                  />
                  <Box display="flex" gap={1} alignItems="center">
                    <IconButton onClick={() => handleSave('header')} color="primary" size="small">
                      <Save />
                    </IconButton>
                    <IconButton onClick={() => stopEditing('header')} size="small">
                      <Cancel />
                    </IconButton>
                  </Box>
                </Box>

                {/* Project Metadata - Editing */}
                <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }} alignItems="flex-start" flexWrap="wrap">
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Project Type</InputLabel>
                    <Select
                      value={specificProject.type || 'vacation'}
                      onChange={(e) => updateProject(specificProject._id, { type: e.target.value })}
                      label="Project Type"
                      size="small"
                    >
                      <MenuItem value="vacation">Vacation</MenuItem>
                      <MenuItem value="home_renovation">Home Renovation</MenuItem>
                      <MenuItem value="investment">Investment</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={specificProject.status || 'planning'}
                      onChange={(e) => updateProject(specificProject._id, { status: e.target.value })}
                      label="Status"
                      size="small"
                    >
                      <MenuItem value="planning">Planning</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      value={specificProject.currency || 'ILS'}
                      onChange={(e) => updateProject(specificProject._id, { currency: e.target.value })}
                      label="Currency"
                      size="small"
                    >
                      {SUPPORTED_CURRENCIES.map(currency => (
                        <MenuItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Box display="flex" gap={2} flex={1} minWidth="300px">
                    <DatePicker
                      label="Start Date"
                      value={new Date(specificProject.startDate)}
                      onChange={(date) => date && updateProject(specificProject._id, { startDate: date })}
                      slotProps={{
                        textField: { size: 'small', sx: { flex: 1 } }
                      }}
                    />
                    <DatePicker
                      label="End Date"
                      value={new Date(specificProject.endDate)}
                      onChange={(date) => date && updateProject(specificProject._id, { endDate: date })}
                      minDate={new Date(specificProject.startDate)}
                      slotProps={{
                        textField: { size: 'small', sx: { flex: 1 } }
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box mb={3}>
                {/* Project Title - View Mode */}
                <Box display="flex" alignItems="center" mb={2} gap={1}>
                  <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
                    {specificProject.name || 'Untitled Project'}
                  </Typography>
                  <IconButton onClick={() => startEditing('header')} size="small">
                    <Edit />
                  </IconButton>
                </Box>

                {/* Project Metadata - View Mode */}
                <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                  <Chip 
                    label={`Type: ${specificProject.type?.charAt(0).toUpperCase() + specificProject.type?.slice(1).replace('_', ' ') || 'Vacation'}`}
                    variant="outlined"
                    size="small"
                  />
                  <Chip 
                    label={`Status: ${specificProject.status?.charAt(0).toUpperCase() + specificProject.status?.slice(1) || 'Planning'}`}
                    color={specificProject.status === 'active' ? 'primary' : specificProject.status === 'completed' ? 'success' : 'default'}
                    size="small"
                  />
                  <Chip 
                    label={`Budget Status: ${getBudgetStatus(
                      specificProject.totalFunding || 0,
                      specificProject.totalBudget || 0,
                      specificProject.totalPaid || 0
                    )}`}
                    color={(() => {
                      const status = getBudgetStatus(
                        specificProject.totalFunding || 0,
                        specificProject.totalBudget || 0,
                        specificProject.totalPaid || 0
                      );
                      return status === 'On Track' ? 'success' : 
                             status === 'Over Plan' ? 'warning' : 'error';
                    })()}
                    size="small"
                  />
                  <Chip 
                    label={`Currency: ${specificProject.currency || 'ILS'}`}
                    variant="outlined"
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {new Date(specificProject.startDate).toLocaleDateString()} - {new Date(specificProject.endDate).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({specificProject.daysRemaining ? `${specificProject.daysRemaining} days remaining` : 'No end date set'})
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Project Overview Visualization */}
            <Box mt={3}>
            <ProjectOverviewVisualization
              totalFunding={specificProject.totalFunding || 0}
              totalBudget={specificProject.totalBudget || 0}
              totalPaid={specificProject.totalPaid || 0}
              totalUnplanned={specificProject.totalUnplannedPaid || 0}
              currency={specificProject.currency || 'ILS'}
              defaultView="pie"
              size={280}
              progressBarHeight={50}
            />
            </Box>

          </Paper>

          {/* Main Content - Three Column Layout */}
          <Box sx={{
            display: 'flex', 
            flexDirection: { xs: 'column', lg: 'row' }, 
            gap: 3 
          }}>
            {/* Funding Sources Column */}
            <Paper sx={{ flex: 1, p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" color="success.main">
                  Funding Sources
                </Typography>
                <Button
                  startIcon={<Add />}
                  onClick={() => {
                    const newSource: FundingSource = {
                      type: 'ongoing_funds',
                      description: '',
                      expectedAmount: 0,
                      availableAmount: 0,
                      currency: specificProject.currency
                    };
                    // Don't save to backend yet - just add to local editing state
                    const newIndex = (specificProject.fundingSources || []).length;
                    setEditingValues({
                      ...editingValues,
                      [`funding_${newIndex}`]: { ...newSource }
                    });
                    setEditingFunding(newIndex);
                  }}
                  variant="outlined"
                  size="small"
                >
                  Add Source
                </Button>
              </Box>

              {(specificProject.fundingSources && specificProject.fundingSources.length > 0) || (editingFunding !== null && editingFunding >= (specificProject.fundingSources || []).length) ? (
                <Box display="flex" flexDirection="column" gap={2}>
                  {/* Existing funding sources */}
                  {(specificProject.fundingSources || []).map((source, index) => (
                    <Card key={index} variant="outlined" sx={{ position: 'relative' }}>
                      <CardContent sx={{ pb: 2 }}>
                        {/* Edit/Save Controls */}
                        <Box position="absolute" top={8} right={8} display="flex" gap={0.5}>
                          {editingFunding === index ? (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => saveFunding(index)}
                                color="primary"
                              >
                                <Save />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => cancelEditingFunding(index)}
                              >
                                <Cancel />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  // Close any other editing sessions first
                                  if (editingBudgetItem !== null) {
                                    setEditingBudgetItem(null);
                                    setEditingValues({});
                                  }
                                  startEditingFunding(index);
                                }}
                                sx={{ color: 'text.secondary' }}
                              >
                                <Edit />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const updated = (specificProject.fundingSources || []).filter((_, i) => i !== index);
                                  updateProject(specificProject._id, { fundingSources: updated });
                                }}
                                sx={{ color: 'error.main' }}
                              >
                                <Delete />
                              </IconButton>
                            </>
                          )}
                        </Box>

                        {editingFunding === index ? (
                          <>
                            {/* Type and Currency Selection */}
                            <Box display="flex" gap={2} mb={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                              <FormControl sx={{ minWidth: 200 }}>
                                <InputLabel>Type</InputLabel>
                                <Select
                                  value={editingValues[`funding_${index}`]?.type || source.type || 'ongoing_funds'}
                                  onChange={(e) => updateEditingValue(`funding_${index}`, 'type', e.target.value)}
                                  label="Type"
                                  size="small"
                                >
                                  {FUNDING_SOURCE_TYPES.map(option => (
                                    <MenuItem key={option.value} value={option.value}>
                                      {option.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl sx={{ minWidth: 120 }}>
                                <InputLabel>Currency</InputLabel>
                                <Select
                                  value={editingValues[`funding_${index}`]?.currency || source.currency || specificProject.currency || 'ILS'}
                                  onChange={(e) => {
                                    updateEditingValue(`funding_${index}`, 'currency', e.target.value);
                                  }}
                                  label="Currency"
                                  size="small"
                                >
                                  {SUPPORTED_CURRENCIES.map(currency => (
                                    <MenuItem key={currency.code} value={currency.code}>
                                      {currency.symbol} {currency.code}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Box>

                            {/* Description */}
                            <TextField
                              fullWidth
                              variant="standard"
                              placeholder="Funding source description..."
                              value={editingValues[`funding_${index}`]?.description || source.description || ''}
                              onChange={(e) => updateEditingValue(`funding_${index}`, 'description', e.target.value)}
                              sx={{ mb: 2 }}
                            />

                            {/* Amount */}
                            <TextField
                              label="Expected Amount"
                              variant="standard"
                              type="number"
                              value={editingValues[`funding_${index}`]?.expectedAmount ?? source.expectedAmount ?? ''}
                              onChange={(e) => updateEditingValue(`funding_${index}`, 'expectedAmount', Number(e.target.value) || 0)}
                              InputProps={{
                                startAdornment: getCurrencySymbol((editingValues[`funding_${index}`]?.currency || source.currency || specificProject.currency || 'ILS')),
                                inputProps: { min: 0, step: 100 }
                              }}
                              fullWidth
                            />
                          </>
                        ) : (
                          <>
                            {/* View Mode */}
                            <Typography variant="subtitle1" gutterBottom>
                              {FUNDING_SOURCE_TYPES.find(t => t.value === source.type)?.label || source.type}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              {source.description || 'No description'}
                            </Typography>
                            <Box display="flex" justifyContent="flex-start" mt={1}>
                              <Typography variant="body2" color="success.main">
                                Amount: {formatCurrency(source.expectedAmount || 0, source.currency || specificProject.currency || 'ILS')}
                              </Typography>
                            </Box>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* New funding source being created */}
                  {editingFunding !== null && editingFunding >= (specificProject.fundingSources || []).length && (
                    <Card key={`new-funding-${editingFunding}`} variant="outlined" sx={{ position: 'relative' }}>
                      <CardContent sx={{ pb: 2 }}>
                        {/* Edit/Save Controls */}
                        <Box position="absolute" top={8} right={8} display="flex" gap={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => saveFunding(editingFunding)}
                            color="primary"
                          >
                            <Save />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => cancelEditingFunding(editingFunding)}
                          >
                            <Cancel />
                          </IconButton>
                        </Box>

                        {/* New funding source editing form */}
                        <Box display="flex" gap={2} mb={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                          <FormControl sx={{ minWidth: 200 }}>
                            <InputLabel>Type</InputLabel>
                            <Select
                              value={editingValues[`funding_${editingFunding}`]?.type || 'ongoing_funds'}
                              onChange={(e) => updateEditingValue(`funding_${editingFunding}`, 'type', e.target.value)}
                              label="Type"
                              size="small"
                            >
                              {FUNDING_SOURCE_TYPES.map(option => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl sx={{ minWidth: 120 }}>
                            <InputLabel>Currency</InputLabel>
                            <Select
                              value={editingValues[`funding_${editingFunding}`]?.currency || specificProject.currency || 'ILS'}
                              onChange={(e) => {
                                console.log('Currency change for NEW funding:', e.target.value);
                                console.log('Before update - editingValues:', editingValues);
                                console.log('Before update - current new funding obj:', editingValues[`funding_${editingFunding}`]);
                                updateEditingValue(`funding_${editingFunding}`, 'currency', e.target.value);
                              }}
                              label="Currency"
                              size="small"
                            >
                              {SUPPORTED_CURRENCIES.map(currency => (
                                <MenuItem key={currency.code} value={currency.code}>
                                  {currency.symbol} {currency.code}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>

                        {/* Description */}
                        <TextField
                          fullWidth
                          variant="standard"
                          placeholder="Funding source description..."
                          value={editingValues[`funding_${editingFunding}`]?.description || ''}
                          onChange={(e) => updateEditingValue(`funding_${editingFunding}`, 'description', e.target.value)}
                          sx={{ mb: 2 }}
                        />

                        {/* Amount */}
                        <TextField
                          label="Expected Amount"
                          variant="standard"
                          type="number"
                          value={editingValues[`funding_${editingFunding}`]?.expectedAmount ?? ''}
                          onChange={(e) => updateEditingValue(`funding_${editingFunding}`, 'expectedAmount', Number(e.target.value) || 0)}
                          InputProps={{
                            startAdornment: getCurrencySymbol((editingValues[`funding_${editingFunding}`]?.currency || specificProject.currency || 'ILS')),
                            inputProps: { min: 0, step: 100 }
                          }}
                          fullWidth
                        />
                      </CardContent>
                    </Card>
                  )}
                </Box>
              ) : (
                <Alert severity="info">
                  No funding sources yet. Click "Add Source" to create your first funding source.
                </Alert>
              )}
            </Paper>

            {/* Project Expenses Column - List Component */}
            <Box sx={{ flex: 1 }}>
              <ProjectExpensesList
                projectId={specificProject._id}
                plannedExpenses={specificProject.categoryBreakdown || []}
                unplannedExpenses={specificProject.unplannedExpenses || []}
                projectCurrency={specificProject.currency || 'ILS'}
                projectType={specificProject.type}
                availableCategories={categories}
                onEditPlannedExpense={(index, updates) => {
                  const updatedCategoryBudgets = updatePlannedExpense(specificProject, index, updates);
                  updateProject(specificProject._id, { categoryBudgets: updatedCategoryBudgets });
                }}
                onDeletePlannedExpense={(index) => {
                  const deletedCategoryBudgets = deletePlannedExpense(specificProject, index);
                  updateProject(specificProject._id, { categoryBudgets: deletedCategoryBudgets });
                }}
                onAddPlannedExpense={async (expenseData) => {
                  const addedCategoryBudgets = addPlannedExpense(specificProject, expenseData);
                  updateProject(specificProject._id, { categoryBudgets: addedCategoryBudgets });
                  
                  // Refresh the project data from the backend to get properly populated categoryBreakdown
                  try {
                    const response = await budgetsApi.getProjectExpenseBreakdown(specificProject._id);
                    console.log('Project expense breakdown response after adding planned expense:', response);
                    
                    // The API returns { success: true, data: { projectId, projectName, categoryBreakdown, ... } }
                    const breakdown = response.data || response;
                    
                    // Update the project in the context with the refreshed data
                    updateProject(specificProject._id, {
                      categoryBreakdown: breakdown.plannedCategories || breakdown.categoryBreakdown,
                      unplannedExpenses: breakdown.unplannedExpenses,
                      totalPaid: breakdown.totalPaid,
                      totalPlannedPaid: breakdown.totalPlannedPaid,
                      totalUnplannedPaid: breakdown.totalUnplannedPaid,
                      progress: breakdown.progress,
                      isOverBudget: breakdown.isOverBudget,
                      remainingBudget: breakdown.totalBudget - breakdown.totalPaid
                    });
                  } catch (error) {
                    console.error('Failed to refresh project data after adding planned expense:', error);
                    // The expense has already been added successfully on the backend
                  }
                }}
                onRemoveFromProject={handleRemoveExpenseFromProject}
                onExpensesMoved={async () => {
                  // Refresh the project data from the backend using the expense breakdown endpoint
                  try {
                    const response = await budgetsApi.getProjectExpenseBreakdown(specificProject._id);
                    console.log('Project expense breakdown response:', response);
                    
                    // The API returns { success: true, data: { projectId, projectName, categoryBreakdown, ... } }
                    const breakdown = response.data || response;
                    
                    // Update the project in the context with the refreshed data
                    updateProject(specificProject._id, {
                      categoryBreakdown: breakdown.plannedCategories || breakdown.categoryBreakdown,
                      unplannedExpenses: breakdown.unplannedExpenses,
                      totalPaid: breakdown.totalPaid,
                      totalPlannedPaid: breakdown.totalPlannedPaid,
                      totalUnplannedPaid: breakdown.totalUnplannedPaid,
                      progress: breakdown.progress,
                      isOverBudget: breakdown.isOverBudget,
                      remainingBudget: breakdown.totalBudget - breakdown.totalPaid
                    });
                  } catch (error) {
                    console.error('Failed to refresh project data after expense move:', error);
                    // Don't reload the page - just log the error and let the user retry if needed
                    // The expense has already been moved successfully on the backend
                  }
                }}
                loading={false}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    );
  }

  // Default: show all projects
  return (
    <Container maxWidth="lg">
      <Box py={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Projects
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Manage your project budgets, track progress, and organize expenses across different initiatives.
        </Typography>
        
        <ProjectBudgetsList 
          projectBudgets={projects} 
          loading={loading}
        />
      </Box>
    </Container>
  );
};

export default Projects;
