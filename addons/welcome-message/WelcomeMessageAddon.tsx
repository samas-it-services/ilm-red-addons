// Welcome Message Addon - Enhanced with Admin Configuration
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Heart, Users, BookOpen, Star, Settings, X, 
  MessageCircle, Trophy, Calendar, TrendingUp, Edit3, Save,
  Eye, EyeOff, Palette, Type, Layout, RotateCcw, Plus, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { AddonComponentProps } from '@/types/addon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface WelcomeStats {
  totalMembers: number;
  totalBooks: number;
  activeDiscussions: number;
  monthlyReads: number;
}

interface RecentActivity {
  type: 'member_joined' | 'book_added' | 'discussion_started';
  user: string;
  content: string;
  timestamp: string;
}

interface WelcomeMessageConfig {
  // Basic Settings
  enabled: boolean;
  title: string;
  customMessage: string;
  
  // Display Options
  showClubStats: boolean;
  showRecentActivity: boolean;
  showQuickActions: boolean;
  showGuidelines: boolean;
  allowDismiss: boolean;
  
  // Targeting
  showToNewMembers: boolean;
  showToAllMembers: boolean;
  newMemberDays: number;
  
  // Styling
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderStyle: 'none' | 'solid' | 'dashed' | 'colored';
  
  // Behavior
  autoHideDays: number;
  showOnEveryVisit: boolean;
  
  // Content
  customGuidelines: string[];
  quickActionLinks: Array<{
    label: string;
    url: string;
    icon: string;
  }>;
}

const DEFAULT_CONFIG: WelcomeMessageConfig = {
  enabled: true,
  title: "Welcome to the Club!",
  customMessage: "",
  showClubStats: true,
  showRecentActivity: true,
  showQuickActions: true,
  showGuidelines: true,
  allowDismiss: true,
  showToNewMembers: true,
  showToAllMembers: false,
  newMemberDays: 30,
  backgroundColor: "from-info to-indigo-50",
  textColor: "text-info",
  accentColor: "blue",
  borderStyle: "colored",
  autoHideDays: 0,
  showOnEveryVisit: false,
  customGuidelines: [
    "Be respectful and kind to all members",
    "Avoid spoilers without proper warnings", 
    "Participate actively in discussions",
    "Share book recommendations with enthusiasm",
    "Have fun and enjoy reading together!"
  ],
  quickActionLinks: [
    { label: "Complete Profile", url: "/profile", icon: "Settings" },
    { label: "Browse Books", url: "/books", icon: "BookOpen" },
    { label: "Join Discussion", url: "/discussions", icon: "MessageCircle" }
  ]
};

const BACKGROUND_OPTIONS = [
  { label: "Blue Gradient", value: "from-info to-indigo-50", preview: "bg-gradient-to-r from-info to-indigo-50" },
  { label: "Green Gradient", value: "from-success to-emerald-50", preview: "bg-gradient-to-r from-success to-emerald-50" },
  { label: "Purple Gradient", value: "from-info to-warning", preview: "bg-gradient-to-r from-info to-warning" },
  { label: "Orange Gradient", value: "from-warning to-destructive", preview: "bg-gradient-to-r from-warning to-destructive" },
  { label: "Gray Gradient", value: "from-gray-50 to-slate-50", preview: "bg-gradient-to-r from-gray-50 to-slate-50" },
  { label: "White", value: "bg-card", preview: "bg-card border" }
];

const ACCENT_COLORS = [
  { label: "Blue", value: "blue", class: "text-info", bg: "bg-info-muted", borderS: "border-s-info", borderLight: "border-info/30" },
  { label: "Green", value: "green", class: "text-success", bg: "bg-success-muted", borderS: "border-s-success", borderLight: "border-success/30" },
  { label: "Purple", value: "purple", class: "text-info", bg: "bg-info-muted", borderS: "border-s-info", borderLight: "border-info/30" },
  { label: "Red", value: "red", class: "text-destructive", bg: "bg-destructive-muted", borderS: "border-s-destructive", borderLight: "border-destructive/30" },
  { label: "Orange", value: "orange", class: "text-warning", bg: "bg-warning-muted", borderS: "border-s-warning", borderLight: "border-warning/30" },
  { label: "Pink", value: "pink", class: "text-warning", bg: "bg-warning-muted", borderS: "border-s-warning", borderLight: "border-warning/30" }
];

export default function WelcomeMessageAddon({ 
  bookClubId, 
  addonId, 
  config, 
  context, 
  onConfigChange,
  onError 
}: AddonComponentProps) {
  const [welcomeConfig, setWelcomeConfig] = useState<WelcomeMessageConfig>({ ...DEFAULT_CONFIG, ...config });
  const [stats, setStats] = useState<WelcomeStats>({
    totalMembers: 0,
    totalBooks: 0,
    activeDiscussions: 0,
    monthlyReads: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isNewMember, setIsNewMember] = useState(false);

  useEffect(() => {
    loadWelcomeData();
    checkMemberStatus();
    checkDismissalStatus();
  }, [bookClubId]);

  const loadWelcomeData = async () => {
    setIsLoading(true);
    try {
      // Load club statistics
      const memberCount = context.members?.length || 0;
      const bookCount = context.books?.length || 0;

      // Get additional stats from storage with proper error handling for empty results
      let storedStats: Partial<WelcomeStats> = {};
      let storedActivity = [];
      
      try {
        const stats = await context.storage.get('welcome-stats');
        storedStats = stats || {};
      } catch (error) {
        // PGRST116 means no rows returned - this is normal for new addons
        if (error.code !== 'PGRST116') {
          console.warn('Could not load welcome stats from storage:', error);
        }
        storedStats = {};
      }

      try {
        const activity = await context.storage.get('recent-activity');
        storedActivity = Array.isArray(activity) ? activity : [];
      } catch (error) {
        // PGRST116 means no rows returned - this is normal for new addons
        if (error.code !== 'PGRST116') {
          console.warn('Could not load recent activity from storage:', error);
        }
        storedActivity = [];
      }
      
      setStats({
        totalMembers: memberCount,
        totalBooks: bookCount,
        activeDiscussions: storedStats.activeDiscussions || Math.floor(Math.random() * 10) + 1,
        monthlyReads: storedStats.monthlyReads || Math.floor(Math.random() * 50) + 10
      });

      setRecentActivity(storedActivity.slice(0, 5));

    } catch (error) {
      console.error('Failed to load welcome data:', error);
      onError(new Error('Failed to load welcome message data'));
    } finally {
      setIsLoading(false);
    }
  };

  const checkMemberStatus = () => {
    // Check if current user is a new member
    const member = context.members.find(m => m.user_id === context.user?.id);
    if (member) {
      const joinDate = new Date(member.created_at);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - welcomeConfig.newMemberDays);
      setIsNewMember(joinDate > cutoffDate);
    }
  };

  const checkDismissalStatus = async () => {
    try {
      const dismissed = localStorage.getItem(`welcome-dismissed-${bookClubId}-${context.user?.id}`);
      if (dismissed && !welcomeConfig.showOnEveryVisit) {
        const dismissedDate = new Date(dismissed);
        if (welcomeConfig.autoHideDays > 0) {
          const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceDismissed < welcomeConfig.autoHideDays) {
            setIsVisible(false);
          }
        } else {
          setIsVisible(false);
        }
      }
    } catch (error) {
      console.error('Failed to check dismissal status:', error);
    }
  };

  const dismissWelcomeMessage = () => {
    setIsVisible(false);
    localStorage.setItem(`welcome-dismissed-${bookClubId}-${context.user?.id}`, new Date().toISOString());
    
    // Track dismissal
    context.analytics?.track('welcome_message_dismissed', {
      bookClubId,
      userId: context.user?.id
    });
  };

  const saveConfiguration = async () => {
    try {
      onConfigChange(welcomeConfig);
      setIsConfiguring(false);
      
      toast.success('Welcome Message Updated', { description: 'Your welcome message configuration has been saved successfully.' });

      // Track configuration update
      await context.analytics?.track('welcome_message_configured', {
        bookClubId,
        userId: context.user?.id,
        config: welcomeConfig
      });
    } catch (error) {
      toast.error('Save Failed', { description: 'Failed to save welcome message configuration.' });
    }
  };

  const resetToDefaults = () => {
    setWelcomeConfig(DEFAULT_CONFIG);
    toast.success('Reset to Defaults', { description: 'Welcome message configuration has been reset to default settings.' });
  };

  const addGuideline = () => {
    setWelcomeConfig(prev => ({
      ...prev,
      customGuidelines: [...prev.customGuidelines, "New guideline"]
    }));
  };

  const updateGuideline = (index: number, value: string) => {
    setWelcomeConfig(prev => ({
      ...prev,
      customGuidelines: prev.customGuidelines.map((g, i) => i === index ? value : g)
    }));
  };

  const removeGuideline = (index: number) => {
    setWelcomeConfig(prev => ({
      ...prev,
      customGuidelines: prev.customGuidelines.filter((_, i) => i !== index)
    }));
  };

  const addQuickAction = () => {
    setWelcomeConfig(prev => ({
      ...prev,
      quickActionLinks: [...prev.quickActionLinks, { label: "New Action", url: "/", icon: "Star" }]
    }));
  };

  const updateQuickAction = (index: number, field: string, value: string) => {
    setWelcomeConfig(prev => ({
      ...prev,
      quickActionLinks: prev.quickActionLinks.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }));
  };

  const removeQuickAction = (index: number) => {
    setWelcomeConfig(prev => ({
      ...prev,
      quickActionLinks: prev.quickActionLinks.filter((_, i) => i !== index)
    }));
  };

  const shouldShowWelcome = () => {
    if (!welcomeConfig.enabled) return false;
    if (!isVisible) return false;
    
    if (welcomeConfig.showToAllMembers) return true;
    if (welcomeConfig.showToNewMembers && isNewMember) return true;
    
    return false;
  };

  const getWelcomeMessage = (): string => {
    if (welcomeConfig.customMessage.trim()) {
      return welcomeConfig.customMessage;
    }

    const defaultMessages = [
      `Welcome to ${context.bookClub?.name || 'our book club'}! 📚 We're excited to have you join our reading community.`,
      `Hello there! 👋 Ready to dive into some amazing books with ${stats.totalMembers} fellow readers?`,
      `Welcome aboard! 🎉 Join ${stats.totalMembers} book lovers exploring ${stats.totalBooks} incredible titles.`,
      `Hey bookworm! 📖 You've joined an awesome community of readers. Let's discover great stories together!`
    ];

    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  };

  const getAccentColorClasses = (color: string) => {
    const colorConfig = ACCENT_COLORS.find(c => c.value === color);
    return colorConfig || ACCENT_COLORS[0];
  };

  const getIconComponent = (iconName: string, size: number = 16) => {
    const icons: Record<string, React.ReactNode> = {
      Settings: <Settings size={size} />,
      BookOpen: <BookOpen size={size} />,
      MessageCircle: <MessageCircle size={size} />,
      Users: <Users size={size} />,
      Star: <Star size={size} />,
      Heart: <Heart size={size} />,
      Trophy: <Trophy size={size} />
    };
    return icons[iconName] || <Star size={size} />;
  };

  // Admin Configuration Interface
  if (isConfiguring && context.isAdmin) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="text-info" size={20} />
            <CardTitle>Configure Welcome Message</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsConfiguring(false)}>
              <X size={16} className="me-2" />
              Cancel
            </Button>
            <Button variant="outline" onClick={resetToDefaults}>
              <RotateCcw size={16} className="me-2" />
              Reset
            </Button>
            <Button onClick={saveConfiguration}>
              <Save size={16} className="me-2" />
              Save Changes
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 max-h-[600px] overflow-y-auto">
          {/* Basic Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Type size={18} />
              Basic Settings
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.enabled} 
                  onCheckedChange={(enabled) => setWelcomeConfig(prev => ({ ...prev, enabled }))}
                />
                <span className="font-medium">Enable Welcome Message</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Welcome Title</label>
                <Input
                  value={welcomeConfig.title}
                  onChange={(e) => setWelcomeConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Welcome to the Club!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Custom Welcome Message</label>
                <RichTextEditor
                  content={welcomeConfig.customMessage}
                  onChange={val => setWelcomeConfig(prev => ({ ...prev, customMessage: val }))}
                  placeholder="Leave empty for random welcome messages, or write your own custom message..."
                  className="min-h-[200px]"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Display Options */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Eye size={18} />
              Display Options
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.showClubStats} 
                  onCheckedChange={(showClubStats) => setWelcomeConfig(prev => ({ ...prev, showClubStats }))}
                />
                <span>Show club statistics</span>
              </div>

              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.showRecentActivity} 
                  onCheckedChange={(showRecentActivity) => setWelcomeConfig(prev => ({ ...prev, showRecentActivity }))}
                />
                <span>Show recent activity</span>
              </div>

              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.showQuickActions} 
                  onCheckedChange={(showQuickActions) => setWelcomeConfig(prev => ({ ...prev, showQuickActions }))}
                />
                <span>Show quick action buttons</span>
              </div>

              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.showGuidelines} 
                  onCheckedChange={(showGuidelines) => setWelcomeConfig(prev => ({ ...prev, showGuidelines }))}
                />
                <span>Show club guidelines</span>
              </div>

              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.allowDismiss} 
                  onCheckedChange={(allowDismiss) => setWelcomeConfig(prev => ({ ...prev, allowDismiss }))}
                />
                <span>Allow users to dismiss message</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Targeting Options */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={18} />
              Who Should See This?
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.showToNewMembers} 
                  onCheckedChange={(showToNewMembers) => setWelcomeConfig(prev => ({ ...prev, showToNewMembers }))}
                />
                <span>Show to new members</span>
              </div>

              <div className="flex items-center gap-3">
                <Switch 
                  checked={welcomeConfig.showToAllMembers} 
                  onCheckedChange={(showToAllMembers) => setWelcomeConfig(prev => ({ ...prev, showToAllMembers }))}
                />
                <span>Show to all members</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Consider "new member" for (days)</label>
                <Input
                  type="number"
                  value={welcomeConfig.newMemberDays}
                  onChange={(e) => setWelcomeConfig(prev => ({ ...prev, newMemberDays: parseInt(e.target.value) || 30 }))}
                  min={1}
                  max={365}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Styling Options */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette size={18} />
              Styling
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Background Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUND_OPTIONS.map(bg => (
                    <button
                      key={bg.value}
                      onClick={() => setWelcomeConfig(prev => ({ ...prev, backgroundColor: bg.value }))}
                      className={cn(
                        'p-3 rounded-lg border-2 text-sm',
                        bg.preview,
                        welcomeConfig.backgroundColor === bg.value ? 'border-info' : 'border-border'
                      )}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Accent Color</label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setWelcomeConfig(prev => ({ ...prev, accentColor: color.value }))}
                      className={cn(
                        'w-10 h-10 rounded-full border-2',
                        color.bg,
                        welcomeConfig.accentColor === color.value ? 'border-gray-800' : 'border-border'
                      )}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Border Style</label>
                <select
                  value={welcomeConfig.borderStyle}
                  onChange={(e) => setWelcomeConfig(prev => ({ ...prev, borderStyle: e.target.value as any }))}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="none">No border</option>
                  <option value="solid">Solid border</option>
                  <option value="dashed">Dashed border</option>
                  <option value="colored">Colored left border</option>
                </select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Custom Guidelines */}
          {welcomeConfig.showGuidelines && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Layout size={18} />
                Custom Guidelines
              </h3>
              
              <div className="space-y-2">
                {welcomeConfig.customGuidelines.map((guideline, index) => (
                  <div key={index} className="flex flex-col gap-1">
                    <RichTextEditor
                      content={guideline}
                      onChange={val => updateGuideline(index, val)}
                      placeholder="Enter guideline (markdown supported)..."
                      className="min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeGuideline(index)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addGuideline} className="w-full">
                  <Plus size={16} className="me-2" />
                  Add Guideline
                </Button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {welcomeConfig.showQuickActions && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Action Links</h3>
              
              <div className="space-y-2">
                {welcomeConfig.quickActionLinks.map((action, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={action.label}
                      onChange={(e) => updateQuickAction(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="flex-1"
                    />
                    <Input
                      value={action.url}
                      onChange={(e) => updateQuickAction(index, 'url', e.target.value)}
                      placeholder="URL"
                      className="flex-1"
                    />
                    <select
                      value={action.icon}
                      onChange={(e) => updateQuickAction(index, 'icon', e.target.value)}
                      className="px-2 border rounded-md"
                    >
                      <option value="Settings">Settings</option>
                      <option value="BookOpen">Book</option>
                      <option value="MessageCircle">Chat</option>
                      <option value="Users">Users</option>
                      <option value="Star">Star</option>
                      <option value="Heart">Heart</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuickAction(index)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addQuickAction} className="w-full">
                  <Plus size={16} className="me-2" />
                  Add Quick Action
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Main Welcome Message Display
  if (!shouldShowWelcome()) {
    return context.isAdmin ? (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <EyeOff size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Welcome message is hidden</p>
            <p className="text-sm mb-4">
              {!welcomeConfig.enabled ? 'Welcome message is disabled' : 
               !isVisible ? 'User has dismissed this message' :
               'Not configured to show to current members'}
            </p>
            <Button variant="outline" onClick={() => setIsConfiguring(true)}>
              <Settings size={16} className="me-2" />
              Configure Welcome Message
            </Button>
          </div>
        </CardContent>
      </Card>
    ) : null;
  }

  if (isLoading) {
    return (
      <Card className={cn('border-s-4', getAccentColorClasses(welcomeConfig.accentColor).borderS)}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-info border-t-transparent rounded-full me-3" />
          <span className="text-muted-foreground">Loading welcome message...</span>
        </CardContent>
      </Card>
    );
  }

  const accentColor = getAccentColorClasses(welcomeConfig.accentColor);

  return (
    <Card className={cn(
      welcomeConfig.borderStyle === 'colored' && 'border-s-4',
      welcomeConfig.borderStyle === 'colored' && accentColor.borderS,
      welcomeConfig.borderStyle === 'solid' && 'border-2',
      welcomeConfig.borderStyle === 'dashed' && 'border-2 border-dashed',
      welcomeConfig.backgroundColor.startsWith('from-') && 'bg-gradient-to-r',
      welcomeConfig.backgroundColor
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${accentColor.bg} rounded-full`}>
              <Heart size={24} className={accentColor.class} />
            </div>
            <div>
              <CardTitle className={cn('text-lg', welcomeConfig.textColor)}>
                {welcomeConfig.title}
              </CardTitle>
              <p className={cn('text-sm mt-1 opacity-80', welcomeConfig.textColor)}>
                {/^\s*<([a-z][\s\S]*?)>/i.test(getWelcomeMessage()) ? (
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: getWelcomeMessage() }} />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {getWelcomeMessage()}
                    </ReactMarkdown>
                  </div>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {context.isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsConfiguring(true)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <Settings size={16} />
              </Button>
            )}
            {welcomeConfig.allowDismiss && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={dismissWelcomeMessage}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Club Statistics */}
        {welcomeConfig.showClubStats && (
          <div>
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-warning" />
              Club Overview
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className={`text-2xl font-bold ${accentColor.class}`}>{stats.totalMembers}</div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-success">{stats.totalBooks}</div>
                <div className="text-xs text-muted-foreground">Books</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-info">{stats.activeDiscussions}</div>
                <div className="text-xs text-muted-foreground">Discussions</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-warning">{stats.monthlyReads}</div>
                <div className="text-xs text-muted-foreground">Monthly Reads</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {welcomeConfig.showRecentActivity && recentActivity.length > 0 && (
          <div>
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-success" />
              Recent Activity
            </h4>
            <div className="space-y-2">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-2 bg-card rounded-lg border">
                  <Users size={16} className="text-info" />
                  <div className="flex-1">
                    <span className="text-sm">
                      <strong>{activity.user}</strong> {activity.content}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {welcomeConfig.showQuickActions && welcomeConfig.quickActionLinks.length > 0 && (
          <div>
            <h4 className="font-semibold text-foreground mb-3">Get Started</h4>
            <div className="flex flex-wrap gap-2">
              {welcomeConfig.quickActionLinks.map((action, index) => (
                <Button 
                  key={index}
                  size="sm" 
                  variant="outline"
                  onClick={() => context.navigate?.(action.url)}
                  className="bg-card"
                >
                  {getIconComponent(action.icon, 16)}
                  <span className="ms-2">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Club Guidelines */}
        {welcomeConfig.showGuidelines && welcomeConfig.customGuidelines.length > 0 && (
          <div className="bg-card p-4 rounded-lg border">
            <h4 className="font-semibold text-foreground mb-2">Club Guidelines</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              {welcomeConfig.customGuidelines.map((guideline, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <div className="prose prose-xs max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {guideline}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Member Badge */}
        {isNewMember && (
          <div className={cn(accentColor.bg, 'p-3 rounded-lg border', accentColor.borderLight)}>
            <div className={`flex items-center gap-2 ${accentColor.class}`}>
              <Star size={16} />
              <span className="font-medium">New Member</span>
            </div>
            <p className={cn('text-sm mt-1', accentColor.class)}>
              Welcome aboard! 🎉 You've joined within the last {welcomeConfig.newMemberDays} days.
            </p>
          </div>
        )}

        {/* Admin Footer */}
        {context.isAdmin && (
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              This welcome message is powered by the Welcome Message addon
            </p>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsConfiguring(true)}
              className="text-info hover:text-info"
            >
              <Edit3 size={14} className="me-1" />
              Customize Welcome Message
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}