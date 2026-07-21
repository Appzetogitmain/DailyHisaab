import React, { useState, useEffect, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  HelpCircle,
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  Star,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  BarChart3,
  Users,
  MessageSquare,
  Compass,
  FileText
} from 'lucide-react';
import apiService from '../../services/api';

// Dynamic Lucide Icon Component
const CategoryIcon = ({ name, className = 'w-5 h-5' }) => {
  if (!name) return <HelpCircle className={className} />;
  
  // Convert kebab-case (e.g. 'help-circle') to PascalCase (e.g. 'HelpCircle')
  const pascalName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
    
  const IconComponent = LucideIcons[pascalName] || HelpCircle;
  return <IconComponent className={className} />;
};

const FAQManagement = () => {
  // State management
  const [categories, setCategories] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // UI states
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    category_name: '',
    category_title: '',
    category_description: '',
    category_icon: 'help-circle',
    sort_order: 0
  });

  const [faqForm, setFaqForm] = useState({
    category_id: '',
    question: '',
    answer: '',
    youtube_tutorial_url: '',
    youtube_thumbnail_url: '',
    youtube_video_id: '',
    is_featured: false,
    sort_order: 1
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [categoriesRes, faqsRes] = await Promise.all([
        apiService.getAllFaqCategories(),
        apiService.getAllFaqs({
          category_id: activeCategory === 'all' ? null : activeCategory,
          search: searchQuery || null
        })
      ]);

      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
      }

      if (faqsRes.success) {
        setFaqs(faqsRes.data.faqs || []);
      }
    } catch (err) {
      console.error('Error fetching FAQ data:', err);
      setError('Failed to load FAQ data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Category management
  const handleCreateCategory = async () => {
    if (!categoryForm.category_name.trim() || !categoryForm.category_title.trim()) {
      setSaveStatus('Name and Title are required.');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      setSaveStatus('Creating category...');
      const response = await apiService.createFaqCategory(categoryForm);

      if (response.success) {
        setSaveStatus('Category created successfully!');
        setShowCategoryModal(false);
        setCategoryForm({
          category_name: '',
          category_title: '',
          category_description: '',
          category_icon: 'help-circle',
          sort_order: 0
        });
        await fetchData();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(response.msg && response.msg[0] ? response.msg[0] : 'Failed to create category.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Error creating category:', err);
      setSaveStatus('Failed to create category. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    if (!categoryForm.category_name.trim() || !categoryForm.category_title.trim()) {
      setSaveStatus('Name and Title are required.');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      setSaveStatus('Updating category...');
      const response = await apiService.updateFaqCategory(editingCategory.category_id, categoryForm);

      if (response.success) {
        setSaveStatus('Category updated successfully!');
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCategoryForm({
          category_name: '',
          category_title: '',
          category_description: '',
          category_icon: 'help-circle',
          sort_order: 0
        });
        await fetchData();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(response.msg && response.msg[0] ? response.msg[0] : 'Failed to update category.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Error updating category:', err);
      setSaveStatus('Failed to update category. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleDeleteCategory = async (categoryId, categoryTitle) => {
    if (!window.confirm(`Are you sure you want to delete the category "${categoryTitle}"? This will also soft-delete all FAQs in this category.`)) return;

    try {
      setSaveStatus('Deleting category...');
      const response = await apiService.deleteFaqCategory(categoryId);

      if (response.success) {
        setSaveStatus('Category deleted successfully!');
        if (activeCategory.toString() === categoryId.toString()) {
          setActiveCategory('all');
        }
        await fetchData();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(response.msg && response.msg[0] ? response.msg[0] : 'Failed to delete category.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      setSaveStatus('Failed to delete category. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      category_name: category.category_name,
      category_title: category.category_title,
      category_description: category.category_description || '',
      category_icon: category.category_icon || 'help-circle',
      sort_order: category.sort_order || 0
    });
    setShowCategoryModal(true);
  };

  // FAQ management
  const handleCreateFaq = async () => {
    if (!faqForm.category_id || !faqForm.question.trim() || !faqForm.answer.trim()) {
      setSaveStatus('Category, Question, and Answer are required.');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      setSaveStatus('Creating FAQ...');
      const response = await apiService.createFaqItem(faqForm);

      if (response.success) {
        setSaveStatus('FAQ created successfully!');
        setShowFaqModal(false);
        setFaqForm({
          category_id: '',
          question: '',
          answer: '',
          youtube_tutorial_url: '',
          youtube_thumbnail_url: '',
          youtube_video_id: '',
          is_featured: false,
          sort_order: 1
        });
        await fetchData();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(response.msg && response.msg[0] ? response.msg[0] : 'Failed to create FAQ.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Error creating FAQ:', err);
      setSaveStatus('Failed to create FAQ. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleUpdateFaq = async () => {
    if (!editingFaq) return;
    if (!faqForm.category_id || !faqForm.question.trim() || !faqForm.answer.trim()) {
      setSaveStatus('Category, Question, and Answer are required.');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      setSaveStatus('Updating FAQ...');
      const response = await apiService.updateFaqItem(editingFaq.faq_id, faqForm);

      if (response.success) {
        setSaveStatus('FAQ updated successfully!');
        setShowFaqModal(false);
        setEditingFaq(null);
        setFaqForm({
          category_id: '',
          question: '',
          answer: '',
          youtube_tutorial_url: '',
          youtube_thumbnail_url: '',
          youtube_video_id: '',
          is_featured: false,
          sort_order: 1
        });
        await fetchData();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(response.msg && response.msg[0] ? response.msg[0] : 'Failed to update FAQ.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Error updating FAQ:', err);
      setSaveStatus('Failed to update FAQ. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleDeleteFaq = async (faqId) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      setSaveStatus('Deleting FAQ...');
      const response = await apiService.deleteFaqItem(faqId);

      if (response.success) {
        setSaveStatus('FAQ deleted successfully!');
        if (expandedFaqId === faqId) setExpandedFaqId(null);
        await fetchData();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(response.msg && response.msg[0] ? response.msg[0] : 'Failed to delete FAQ.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting FAQ:', err);
      setSaveStatus('Failed to delete FAQ. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleEditFaq = (faq) => {
    setEditingFaq(faq);
    setFaqForm({
      category_id: faq.category_id,
      question: faq.question,
      answer: faq.answer,
      youtube_tutorial_url: faq.youtube_tutorial_url || '',
      youtube_thumbnail_url: faq.youtube_thumbnail_url || '',
      youtube_video_id: faq.youtube_video_id || '',
      is_featured: faq.is_featured || false,
      sort_order: faq.sort_order || 1,
      is_active: faq.is_active !== undefined ? (faq.is_active ? 1 : 0) : 1
    });
    setShowFaqModal(true);
  };

  const handleAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiService.getFaqAnalytics();
      if (response.success) {
        setAnalytics(response.data);
        setShowAnalyticsModal(true);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url) => {
    if (!url) return '';
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  // Update YouTube fields when URL changes
  const handleYouTubeUrlChange = (url) => {
    const videoId = extractYouTubeId(url);
    setFaqForm(prev => ({
      ...prev,
      youtube_tutorial_url: url,
      youtube_video_id: videoId,
      youtube_thumbnail_url: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : ''
    }));
  };

  if (loading && !showAnalyticsModal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-base text-gray-600 font-medium">Loading FAQ System...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center bg-red-50 p-6 rounded-xl border border-red-100 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-semibold mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm text-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">FAQ & Help Desk Management</h2>
          <p className="text-sm text-slate-500 mt-1">Organize frequently asked questions and group them by functional categories.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleAnalytics}
            className="flex items-center justify-center px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all text-sm font-semibold shadow-sm active:scale-95"
          >
            <BarChart3 size={16} className="mr-2 text-purple-600" />
            View Analytics
          </button>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({
                category_name: '',
                category_title: '',
                category_description: '',
                category_icon: 'help-circle',
                sort_order: 0
              });
              setShowCategoryModal(true);
            }}
            className="flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all text-sm font-semibold shadow-sm active:scale-95"
          >
            <Plus size={16} className="mr-2" />
            Add Category
          </button>
          <button
            onClick={() => {
              setEditingFaq(null);
              setFaqForm({
                category_id: activeCategory !== 'all' && activeCategory !== '1' ? activeCategory : '',
                question: '',
                answer: '',
                youtube_tutorial_url: '',
                youtube_thumbnail_url: '',
                youtube_video_id: '',
                is_featured: false,
                sort_order: 1
              });
              setShowFaqModal(true);
            }}
            className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-sm font-semibold shadow-sm active:scale-95"
          >
            <Plus size={16} className="mr-2" />
            Add FAQ
          </button>
        </div>
      </div>

      {/* Save Status Notification */}
      {saveStatus && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-xl shadow-sm text-sm text-blue-800 transition-all duration-300">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-medium">{saveStatus}</span>
          </div>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Categories Management Panel (4/12 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm tracking-wide uppercase">FAQ Categories</span>
              <span className="text-xs px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-full font-semibold">
                {categories.filter(c => c.category_id !== 1).length} Categories
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              
              {/* All FAQs Filter Card */}
              <div 
                onClick={() => setActiveCategory('all')}
                className={`p-4 flex items-center justify-between cursor-pointer transition-all border-l-4 ${
                  activeCategory === 'all' 
                    ? 'bg-blue-50/70 border-blue-600' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className={`p-2.5 rounded-xl transition-all ${
                    activeCategory === 'all' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">All FAQs</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Show all questions from all groups</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  {categories.reduce((acc, cat) => acc + (cat.active_faqs || 0), 0)}
                </span>
              </div>

              {/* Individual Category Cards */}
              {categories
                .filter(c => c.category_id !== 1 && c.category_name !== 'all')
                .map(category => {
                  const isSelected = activeCategory.toString() === category.category_id.toString();
                  return (
                    <div 
                      key={category.category_id}
                      onClick={() => setActiveCategory(category.category_id)}
                      className={`p-4 flex items-start justify-between cursor-pointer transition-all border-l-4 relative group ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-600' 
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3.5 pr-8">
                        <div className={`p-2.5 rounded-xl transition-all mt-0.5 ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <CategoryIcon name={category.category_icon} className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5 flex-wrap">
                            {category.category_title}
                            {!category.is_active && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-bold">Inactive</span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {category.category_description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Action buttons & counters */}
                      <div className="flex flex-col items-end justify-between h-full space-y-4 self-stretch flex-shrink-0">
                        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                          {category.active_faqs || 0}
                        </span>
                        
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCategory(category);
                            }}
                            className="p-1 hover:bg-slate-200 text-blue-600 rounded-lg transition-colors"
                            title="Edit Category"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(category.category_id, category.category_title);
                            }}
                            className="p-1 hover:bg-slate-200 text-rose-600 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: FAQ Accordion Panel (8/12 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Search bar inside FAQs */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by question or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-3 py-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                Clear Search
              </button>
            )}
          </div>

          {/* Accordion Questions List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 text-sm tracking-wide uppercase flex justify-between items-center">
              <span>
                {activeCategory === 'all' 
                  ? 'All FAQ Questions' 
                  : `Questions in: ${categories.find(c => c.category_id.toString() === activeCategory.toString())?.category_title || 'Category'}`
                }
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                {faqs.length} FAQs
              </span>
            </div>

            {faqs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {faqs.map((faq) => {
                  const isExpanded = expandedFaqId === faq.faq_id;
                  return (
                    <div key={faq.faq_id} className={`transition-all duration-200 ${isExpanded ? 'bg-blue-50/10' : 'hover:bg-slate-50/40'}`}>
                      
                      {/* Accordion Trigger Header */}
                      <div 
                        onClick={() => setExpandedFaqId(isExpanded ? null : faq.faq_id)}
                        className="p-4 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center space-x-3.5 flex-1 min-w-0 pr-4">
                          {faq.is_featured ? (
                            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 fill-amber-400" />
                          ) : (
                            <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-semibold text-slate-800 block leading-snug">
                              {faq.question}
                            </span>
                            
                            {/* Meta badges inside row */}
                            <div className="flex flex-wrap gap-2 mt-2 items-center">
                              {activeCategory === 'all' && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800">
                                  {faq.category_title}
                                </span>
                              )}
                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                                faq.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {faq.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {faq.view_count || 0} views
                              </span>
                              {faq.youtube_tutorial_url && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-700">
                                  <Play size={8} className="mr-1 fill-rose-600 text-rose-600" />
                                  Video Tutorial
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions for editing and deleting FAQs */}
                        <div className="flex items-center space-x-3.5 flex-shrink-0">
                          <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEditFaq(faq)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit FAQ"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteFaq(faq.faq_id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Delete FAQ"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className={`p-1 rounded-lg transition-all ${isExpanded ? 'bg-blue-100/50 text-blue-600 rotate-180' : 'text-slate-400'}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* Accordion Collapsible Answer */}
                      {isExpanded && (
                        <div className="px-12 pb-5 pt-1.5 text-sm text-slate-600 border-t border-slate-50 bg-slate-50/20">
                          <div className="whitespace-pre-line leading-relaxed text-slate-600 font-medium">
                            {faq.answer}
                          </div>
                          
                          {/* Youtube block */}
                          {faq.youtube_tutorial_url && (
                            <div className="mt-4 p-3.5 bg-white rounded-xl border border-slate-100 flex items-start space-x-4 max-w-xl shadow-sm">
                              {faq.youtube_thumbnail_url ? (
                                <div className="relative group flex-shrink-0 cursor-pointer overflow-hidden rounded-lg">
                                  <img
                                    src={faq.youtube_thumbnail_url}
                                    alt="Video thumbnail"
                                    className="w-32 h-20 object-cover border border-slate-100 transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="p-2 bg-red-600 rounded-full text-white shadow-md">
                                      <Play className="w-4 h-4 fill-white" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-rose-50 text-rose-500 rounded-lg border border-rose-100 flex-shrink-0">
                                  <Play className="w-6 h-6 fill-rose-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Video Tutorial Available</h5>
                                <p className="text-xs text-slate-400 mt-1 truncate">{faq.youtube_tutorial_url}</p>
                                <a 
                                  href={faq.youtube_tutorial_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="mt-3.5 inline-flex items-center text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-150 transition-all"
                                >
                                  Watch on YouTube
                                  <Play size={10} className="ml-1.5 fill-rose-700 text-rose-700" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <HelpCircle className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                <h3 className="text-base font-bold text-slate-700 mb-1">No FAQs found</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto leading-normal">There are no questions listed in this category matching your filter.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Create/Edit Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCategory ? 'Edit FAQ Category' : 'Create FAQ Category'}
              </h3>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category Code / Name (unique identifier)</label>
                <input
                  type="text"
                  value={categoryForm.category_name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, category_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g. troubleshooting_guide"
                  disabled={!!editingCategory} // Keep slug name fixed during edits
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category Title (Display Name)</label>
                <input
                  type="text"
                  value={categoryForm.category_title}
                  onChange={(e) => setCategoryForm({ ...categoryForm, category_title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g. Troubleshooting Guide"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={categoryForm.category_description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, category_description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows="3"
                  placeholder="Summarize what questions this category holds..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lucide Icon String</label>
                  <input
                    type="text"
                    value={categoryForm.category_icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, category_icon: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g. book-open, tool"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              {editingCategory && (
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="cat_is_active"
                    checked={categoryForm.is_active !== 0}
                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked ? 1 : 0 })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="cat_is_active" className="text-sm font-semibold text-slate-700 select-none">
                    Category Active (Available for Users)
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="px-4 py-2 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm shadow-blue-100"
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit FAQ Modal */}
      {showFaqModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {editingFaq ? 'Edit FAQ Question' : 'Create FAQ Question'}
              </h3>
              <button 
                onClick={() => {
                  setShowFaqModal(false);
                  setEditingFaq(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Category</label>
                <select
                  value={faqForm.category_id}
                  onChange={(e) => setFaqForm({ ...faqForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Select a Category</option>
                  {categories
                    .filter(category => category.category_id !== 1 && category.category_name !== 'all')
                    .map(category => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Question (Hindi or English)</label>
                <input
                  type="text"
                  value={faqForm.question}
                  onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-semibold"
                  placeholder="e.g. How do I backup my data?"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Answer Body</label>
                <textarea
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows="5"
                  placeholder="Provide a clear, step-by-step resolution..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">YouTube Video Link (Optional)</label>
                <input
                  type="url"
                  value={faqForm.youtube_tutorial_url}
                  onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              {faqForm.youtube_thumbnail_url && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl max-w-sm flex items-center space-x-3.5">
                  <img
                    src={faqForm.youtube_thumbnail_url}
                    alt="Video thumbnail"
                    className="w-24 h-14 object-cover rounded border border-slate-150 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-600 block tracking-wide uppercase">YouTube URL Loaded</span>
                    <span className="text-xs text-slate-400 block truncate">{faqForm.youtube_video_id}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-6 items-center pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={faqForm.is_featured}
                    onChange={(e) => setFaqForm({ ...faqForm, is_featured: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_featured" className="text-sm font-semibold text-slate-700 select-none">
                    Featured (Pin to top)
                  </label>
                </div>
                
                {editingFaq && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="faq_is_active"
                      checked={faqForm.is_active !== 0}
                      onChange={(e) => setFaqForm({ ...faqForm, is_active: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="faq_is_active" className="text-sm font-semibold text-slate-700 select-none">
                      Active (Display to public)
                    </label>
                  </div>
                )}

                <div className="flex items-center space-x-2 ml-auto">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort Order</label>
                  <input
                    type="number"
                    value={faqForm.sort_order}
                    onChange={(e) => setFaqForm({ ...faqForm, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-16 px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowFaqModal(false);
                  setEditingFaq(null);
                }}
                className="px-4 py-2 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={editingFaq ? handleUpdateFaq : handleCreateFaq}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm shadow-blue-100"
              >
                {editingFaq ? 'Save FAQ' : 'Create FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Report Modal */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900">FAQ Traffic & Analytics</h3>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {analytics.analytics && (
              <div className="space-y-6">
                
                {/* Scorecards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-2xl">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm mr-3">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Total Active FAQs</p>
                        <p className="text-2xl font-black text-blue-900 mt-0.5">{analytics.total_faqs || 0}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-2xl">
                    <div className="flex items-center">
                      <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm mr-3">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Total views</p>
                        <p className="text-2xl font-black text-emerald-900 mt-0.5">
                          {analytics.analytics.reduce((sum, item) => sum + (item.view_count || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50/50 p-4 border border-purple-100 rounded-2xl">
                    <div className="flex items-center">
                      <div className="p-3 bg-purple-600 text-white rounded-xl shadow-sm mr-3">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">Unique Readers</p>
                        <p className="text-2xl font-black text-purple-900 mt-0.5">
                          {analytics.analytics.reduce((sum, item) => sum + (item.unique_users || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table list inside analytics */}
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150">
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Question Title</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Total Views</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Unique Users</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.analytics.map((item) => (
                          <tr key={item.faq_id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 text-sm font-semibold text-slate-800">{item.question}</td>
                            <td className="px-5 py-3 text-sm">
                              <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-600">
                                {item.category_title}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-600 font-bold text-center">{item.view_count || 0}</td>
                            <td className="px-5 py-3 text-sm text-slate-600 font-bold text-center">{item.unique_users || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default FAQManagement;
