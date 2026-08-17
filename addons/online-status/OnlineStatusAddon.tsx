// Online Status Addon Component
import React, { useState, useEffect } from 'react';
import { Users, Eye, EyeOff, Circle, Settings, Clock, Activity, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { AddonComponentProps } from '@/types/addon';

interface OnlineStatusConfig {
  enabled: boolean;
  showLastSeen: boolean;
  showActivityStatus: boolean;
  allowPrivateMode: boolean;
  autoOfflineMinutes: number;
  showOnlineCount: boolean;
  groupByStatus: boolean;
  showUserRoles: boolean;
}

interface UserStatus {
  userId: string;
  username: string;
  avatar?: string;
  role: string;
  status: 'online' | 'idle' | 'offline';
  lastSeen: Date;
  isPrivate: boolean;
  currentActivity?: string;
  location?: string; // What part of the app they're in
}

interface ActivityLocation {
  type: 'reading' | 'discussing' | 'browsing' | 'chatting' | 'idle';
  details?: string; // Book title, discussion topic, etc.
}

const DEFAULT_CONFIG: OnlineStatusConfig = {
  enabled: true,
  showLastSeen: true,
  showActivityStatus: true,
  allowPrivateMode: true,
  autoOfflineMinutes: 15,
  showOnlineCount: true,
  groupByStatus: true,
  showUserRoles: false
};

const STATUS_COLORS = {
  online: 'text-success',
  idle: 'text-warning',
  offline: 'text-muted-foreground'
};

const STATUS_LABELS = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline'
};

const ACTIVITY_ICONS = {
  reading: '📖',
  discussing: '💬',
  browsing: '👀',
  chatting: '💭',
  idle: '⏰'
};

export default function OnlineStatusAddon({ bookClubId, addonId, config, context, onConfigChange, onError }: AddonComponentProps) {
  const [statusConfig, setStatusConfig] = useState<OnlineStatusConfig>({ ...DEFAULT_CONFIG, ...config });
  const [showSettings, setShowSettings] = useState(false);
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [currentUserPrivate, setCurrentUserPrivate] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Debounce storage operations to prevent race conditions
  const [pendingStorageOps, setPendingStorageOps] = useState<Set<string>>(new Set());

  // Helper function to safely set storage values with debouncing
  const safeStorageSet = async (key: string, value: any, debounceMs: number = 100): Promise<void> => {
    const operationKey = `${key}_${JSON.stringify(value)}`;
    
    if (pendingStorageOps.has(operationKey)) {
      // Operation already pending, skip
      return;
    }
    
    setPendingStorageOps(prev => new Set([...prev, operationKey]));
    
    try {
      // Debounce the operation
      await new Promise(resolve => setTimeout(resolve, debounceMs));
      await context.storage.set(key, value);
    } catch (error) {
      console.warn(`Storage operation failed for key '${key}':`, error);
      // Don't throw - storage failures shouldn't break the addon
    } finally {
      setPendingStorageOps(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationKey);
        return newSet;
      });
    }
  };

  useEffect(() => {
    if (statusConfig.enabled) {
      loadInitialStatuses();
      startPresenceTracking();
      setupRealtimeSubscription();
    } else {
      stopPresenceTracking();
    }

    return () => {
      stopPresenceTracking();
    };
  }, [statusConfig.enabled]);

  useEffect(() => {
    // Track user activity
    const handleActivity = () => {
      setLastActivity(new Date());
      updateUserActivity();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  const loadInitialStatuses = async () => {
    try {
      // Check user's privacy setting
      const privacySetting = await context.storage.get('online_status_private');
      setCurrentUserPrivate(privacySetting || false);

      // Load cached statuses with timestamp
      const cachedData = await context.storage.get('cached_user_statuses_with_timestamp');
      if (cachedData && cachedData.statuses) {
        setUserStatuses(cachedData.statuses.map((status: any) => ({
          ...status,
          lastSeen: new Date(status.lastSeen)
        })));
      }

      // Only fetch fresh statuses if cache is old or missing
      if (!cachedData || !cachedData.timestamp || 
          (Date.now() - new Date(cachedData.timestamp).getTime()) > 30000) {
        await fetchUserStatuses();
      }
    } catch (error) {
      console.error('Failed to load initial statuses:', error);
    }
  };

  const fetchUserStatuses = async () => {
    try {
      // First check if we have recent cached data (less than 30 seconds old)
      let cachedData = null;
      try {
        cachedData = await context.storage.get('cached_user_statuses_with_timestamp');
      } catch (error) {
        // Ignore cache errors - PGRST116 is normal for first-time loads
        if (error.code !== 'PGRST116' && !error.message?.includes('0 rows')) {
          console.warn('Could not load cached user statuses:', error);
        }
      }
      
      if (cachedData && cachedData.timestamp) {
        const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
        if (cacheAge < 30000) { // Less than 30 seconds old - doubled cache time
          // Use cached data
          setUserStatuses(cachedData.statuses.map((status: any) => ({
            ...status,
            lastSeen: new Date(status.lastSeen)
          })));
          return;
        }
      }

      // Use a single storage call to get all presence data - much more efficient
      let allPresenceData = {};
      try {
        allPresenceData = await context.storage.get('all_user_presence') || {};
      } catch (error) {
        // PGRST116 is normal for new data
        if (error.code !== 'PGRST116' && !error.message?.includes('0 rows')) {
          console.warn('Could not load all presence data:', error);
        }
      }

      // Create presence map from consolidated data
      const presenceMap = new Map();
      context.members.forEach((member) => {
        const presenceData = allPresenceData[member.user_id] || null;
        presenceMap.set(member.user_id, presenceData);
      });

      // Remove the individual Promise.all calls - we now use consolidated data

      const statuses: UserStatus[] = context.members.map((member) => {
        const presenceData = presenceMap.get(member.user_id);
        
        // Determine status based on stored presence data
        let status: UserStatus['status'] = 'offline';
        let lastSeen = new Date(Date.now() - 3600000); // Default to 1 hour ago
        let currentActivity: string | undefined;
        let isPrivate = false;

        if (presenceData) {
          const lastUpdate = new Date(presenceData.timestamp);
          const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60);
          
          if (minutesSinceUpdate < statusConfig.autoOfflineMinutes) {
            status = presenceData.status || 'online';
          } else {
            status = 'offline';
          }
          
          lastSeen = lastUpdate;
          currentActivity = presenceData.currentActivity;
          isPrivate = presenceData.isPrivate || false;
        }

        // Privacy: Only show email to admins and super_admins
        const canSeePrivateInfo = context.isAdmin || context.user?.roles?.includes('super_admin');
        const displayName = member.profiles?.full_name || 
          (canSeePrivateInfo ? member.profiles?.email : null) || 
          'Anonymous User';

        return {
          userId: member.user_id,
          username: displayName,
          avatar: member.profiles?.profile_picture_url,
          role: member.role,
          status,
          lastSeen,
          isPrivate,
          currentActivity: status === 'online' ? currentActivity : undefined
        };
      });

      setUserStatuses(statuses);

      // Cache the statuses with timestamp for 30-second caching
      await safeStorageSet('cached_user_statuses_with_timestamp', {
        statuses,
        timestamp: new Date().toISOString()
      }, 500); // Increased debounce delay

      // Track analytics (less frequently)
      const now = Date.now();
      const lastAnalytics = await context.storage.get('last_analytics_track') || 0;
      if (now - lastAnalytics > 60000) { // Only track once per minute
        await safeStorageSet('last_analytics_track', now, 0);
        if (context.analytics) {
          await context.analytics.track('user_statuses_loaded', {
            totalUsers: statuses.length,
            onlineUsers: statuses.filter(s => s.status === 'online').length,
            privateUsers: statuses.filter(s => s.isPrivate).length
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch user statuses:', error);
    }
  };

  const getRandomActivity = (): string => {
    const activities = [
      'Reading "The Great Gatsby"',
      'In book discussion',
      'Browsing the bookshelf',
      'Writing review',
      'Checking notifications'
    ];
    return activities[Math.floor(Math.random() * activities.length)];
  };

  const startPresenceTracking = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Send presence heartbeat every 60 seconds (reduced frequency)
    const interval = setInterval(async () => {
      await sendPresenceHeartbeat();
    }, 60000); // Increased from 30s to 60s
    
    setHeartbeatInterval(interval);

    // Send initial heartbeat
    sendPresenceHeartbeat();
  };

  const stopPresenceTracking = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }

    // Send offline status
    sendPresenceUpdate('offline');
  };

  const sendPresenceHeartbeat = async () => {
    try {
      context.api.requirePermission('track_users');

      const now = new Date();
      const timeSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000 / 60; // minutes

      let status: UserStatus['status'] = 'online';
      if (timeSinceActivity > statusConfig.autoOfflineMinutes) {
        status = 'offline';
      } else if (timeSinceActivity > 5) {
        status = 'idle';
      }

      await sendPresenceUpdate(status);
    } catch (error) {
      console.error('Failed to send presence heartbeat:', error);
    }
  };

  const sendPresenceUpdate = async (status: UserStatus['status']) => {
    try {
      const presenceData = {
        bookClubId,
        userId: context.user?.id,
        status,
        isPrivate: currentUserPrivate,
        currentActivity: status === 'online' ? 'Using addon system' : undefined,
        timestamp: new Date().toISOString(),
        username: context.user?.email || 'Unknown User',
        role: context.members.find(m => m.user_id === context.user?.id)?.role || 'member'
      };

      // Update consolidated presence data - single storage call instead of multiple
      try {
        const allPresenceData = await context.storage.get('all_user_presence') || {};
        allPresenceData[context.user?.id] = presenceData;
        await safeStorageSet('all_user_presence', allPresenceData, 200);
      } catch (error) {
        // Fallback to individual storage if consolidated fails
        console.warn('Could not update consolidated presence, using fallback:', error);
        await safeStorageSet(`presence_${context.user?.id}`, presenceData, 50);
      }

      // Update local status immediately
      setUserStatuses(prev => 
        prev.map(user => 
          user.userId === context.user?.id 
            ? { ...user, status, lastSeen: new Date(), isPrivate: currentUserPrivate }
            : user
        )
      );
    } catch (error) {
      console.warn('Failed to send presence update:', error);
    }
  };

  const updateUserActivity = async () => {
    // Only update activity every 30 seconds to reduce API calls
    const now = Date.now();
    const lastActivityUpdate = localStorage.getItem(`last_activity_update_${bookClubId}_${context.user?.id}`);
    if (lastActivityUpdate && (now - parseInt(lastActivityUpdate)) < 30000) {
      return; // Skip update if less than 30 seconds since last update
    }
    
    localStorage.setItem(`last_activity_update_${bookClubId}_${context.user?.id}`, now.toString());

    const currentPath = window.location.pathname;
    let activity = 'Active in book club';

    if (currentPath.includes('/books/')) {
      activity = 'Reading a book';
    } else if (currentPath.includes('/discussions/')) {
      activity = 'In discussions';
    } else if (currentPath.includes('/members/')) {
      activity = 'Viewing members';
    } else if (currentPath.includes('/addon-')) {
      activity = 'Using addons';
    }

    // Update activity in consolidated presence data
    try {
      const allPresenceData = await context.storage.get('all_user_presence') || {};
      if (allPresenceData[context.user?.id]) {
        allPresenceData[context.user?.id].currentActivity = activity;
        allPresenceData[context.user?.id].timestamp = new Date().toISOString();
        await safeStorageSet('all_user_presence', allPresenceData, 300); // Higher debounce for activity
      }
    } catch (error) {
      console.warn('Could not update user activity:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    // Fetch all user statuses only every 30 seconds to drastically reduce API calls
    const interval = setInterval(() => {
      fetchUserStatuses();
    }, 30000); // Increased from 15s to 30s

    return () => clearInterval(interval);
  };

  const togglePrivateMode = async () => {
    const newPrivateState = !currentUserPrivate;
    setCurrentUserPrivate(newPrivateState);
    
    try {
      await safeStorageSet('online_status_private', newPrivateState, 0);
      await sendPresenceUpdate(getCurrentUserStatus());
      
      toast.success(newPrivateState ? 'Private mode enabled' : 'Private mode disabled', { description: newPrivateState 
          ? 'Your online status is now hidden from other members'
          : 'Your online status is now visible to other members' });

      await context.analytics.track('privacy_toggle', {
        userId: context.user?.id,
        isPrivate: newPrivateState
      });
    } catch (error) {
      toast.error('Failed to update privacy', { description: 'Could not change your privacy setting' });
      setCurrentUserPrivate(!newPrivateState); // Revert
    }
  };

  const getCurrentUserStatus = (): UserStatus['status'] => {
    const now = new Date();
    const timeSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000 / 60;

    if (timeSinceActivity > statusConfig.autoOfflineMinutes) return 'offline';
    if (timeSinceActivity > 5) return 'idle';
    return 'online';
  };

  const saveConfig = async () => {
    try {
      onConfigChange(statusConfig);
      setShowSettings(false);
      
      toast.success('Settings saved', { description: 'Online status configuration has been updated' });
    } catch (error) {
      toast.error('Save failed', { description: 'Failed to save online status settings' });
    }
  };

  const getStatusIcon = (status: UserStatus['status']) => {
    return <Circle className={`w-3 h-3 ${STATUS_COLORS[status]} ${status === 'online' ? 'fill-current' : ''}`} />;
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 1000 / 60);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const groupedStatuses = statusConfig.groupByStatus 
    ? {
        online: userStatuses.filter(u => u.status === 'online'),
        idle: userStatuses.filter(u => u.status === 'idle'),
        offline: userStatuses.filter(u => u.status === 'offline')
      }
    : { all: userStatuses };

  const onlineCount = userStatuses.filter(u => u.status === 'online' && !u.isPrivate).length;
  const totalCount = userStatuses.filter(u => !u.isPrivate).length;

  if (showSettings && context.isAdmin) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Online Status Settings</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig}>
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.enabled}
                onCheckedChange={(enabled) => setStatusConfig(prev => ({ ...prev, enabled }))}
              />
              Enable online status tracking
            </label>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Display Options</h4>
            
            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.showLastSeen}
                onCheckedChange={(showLastSeen) => setStatusConfig(prev => ({ ...prev, showLastSeen }))}
              />
              Show last seen timestamps
            </label>

            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.showActivityStatus}
                onCheckedChange={(showActivityStatus) => setStatusConfig(prev => ({ ...prev, showActivityStatus }))}
              />
              Show current activity
            </label>

            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.showOnlineCount}
                onCheckedChange={(showOnlineCount) => setStatusConfig(prev => ({ ...prev, showOnlineCount }))}
              />
              Show online member count
            </label>

            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.groupByStatus}
                onCheckedChange={(groupByStatus) => setStatusConfig(prev => ({ ...prev, groupByStatus }))}
              />
              Group members by status
            </label>

            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.showUserRoles}
                onCheckedChange={(showUserRoles) => setStatusConfig(prev => ({ ...prev, showUserRoles }))}
              />
              Show member roles
            </label>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Privacy Options</h4>
            
            <label className="flex items-center gap-2">
              <Switch
                checked={statusConfig.allowPrivateMode}
                onCheckedChange={(allowPrivateMode) => setStatusConfig(prev => ({ ...prev, allowPrivateMode }))}
              />
              Allow members to hide their status
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Auto-offline timeout (minutes)</label>
            <select
              value={statusConfig.autoOfflineMinutes}
              onChange={(e) => setStatusConfig(prev => ({ ...prev, autoOfflineMinutes: parseInt(e.target.value) }))}
              className="w-full p-2 border rounded-md"
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statusConfig.enabled) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Eye size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Online status is disabled</p>
            <p className="text-sm">Contact an admin to enable this feature</p>
            {context.isAdmin && (
              <Button variant="outline" className="mt-4" onClick={() => setShowSettings(true)}>
                <Settings size={16} className="me-2" />
                Enable & Configure
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <Users className="text-success" size={20} />
          <CardTitle className="text-lg">Online Status</CardTitle>
          {statusConfig.showOnlineCount && (
            <Badge variant="secondary">
              {onlineCount} / {totalCount} online
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusConfig.allowPrivateMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePrivateMode}
              className={currentUserPrivate ? 'text-warning' : 'text-success'}
            >
              {currentUserPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          )}
          {context.isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
            </Button>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-y-auto space-y-4">
          {currentUserPrivate && (
            <div className="bg-warning-muted p-3 rounded-lg border border-warning">
              <div className="flex items-center gap-2 text-warning">
                <Shield size={16} />
                <span className="font-medium">Private Mode Active</span>
              </div>
              <p className="text-sm text-warning mt-1">
                Your online status is hidden from other members
              </p>
            </div>
          )}

          {Object.entries(groupedStatuses).map(([statusGroup, users]) => (
            <div key={statusGroup}>
              {statusConfig.groupByStatus && statusGroup !== 'all' && (
                <div className="flex items-center gap-2 mb-3">
                  {getStatusIcon(statusGroup as UserStatus['status'])}
                  <h4 className="font-medium capitalize">
                    {STATUS_LABELS[statusGroup as UserStatus['status']]} ({users.length})
                  </h4>
                </div>
              )}
              
              <div className="space-y-2">
                {users
                  .filter(user => !user.isPrivate || user.userId === context.user?.id)
                  .sort((a, b) => {
                    // Sort by status priority, then by last seen
                    const statusPriority = { online: 3, idle: 2, offline: 1 };
                    if (a.status !== b.status) {
                      return statusPriority[b.status] - statusPriority[a.status];
                    }
                    return b.lastSeen.getTime() - a.lastSeen.getTime();
                  })
                  .map(user => (
                    <div key={user.userId} className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {user.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -end-1">
                          {getStatusIcon(user.status)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {user.username}
                          </span>
                          {user.userId === context.user?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                          {statusConfig.showUserRoles && user.role !== 'member' && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {user.role}
                            </Badge>
                          )}
                          {user.isPrivate && (
                            <EyeOff size={12} className="text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {statusConfig.showActivityStatus && user.currentActivity && user.status === 'online' && (
                            <div className="flex items-center gap-1 mb-1">
                              <Activity size={10} />
                              <span className="truncate">{user.currentActivity}</span>
                            </div>
                          )}
                          
                          {statusConfig.showLastSeen && (
                            <div className="flex items-center gap-1">
                              <Clock size={10} />
                              <span>
                                {user.status === 'online' 
                                  ? 'Active now' 
                                  : `Last seen ${formatLastSeen(user.lastSeen)}`
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              
              {statusGroup !== 'all' && users.length === 0 && (
                <div className="text-center text-muted-foreground py-4 text-sm">
                  No {statusGroup} members
                </div>
              )}
            </div>
          ))}

          {userStatuses.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Loading member status...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}