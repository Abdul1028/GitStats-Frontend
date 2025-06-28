'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Calendar, 
  Star, 
  Zap,
  Crown,
  Medal,
  Award,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';

// Achievement Types
interface AchievementCriteria {
  type: string;
  dataSource: string;
  target: number;
  parameters: Record<string, any>;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  rarity: string;
  criteria: AchievementCriteria;
  unlocked: boolean;
  currentProgress: number;
  targetProgress: number;
  percentage: number;
  unlockedDate: string | null;
  lastUpdated: string;
}

interface AchievementStats {
  totalAchievements: number;
  unlockedAchievements: number;
  lockedAchievements: number;
  overallProgress: number;
  rarestAchievement: string;
  mostRecentAchievement: string;
}

interface AchievementResponse {
  achievements: Achievement[];
  stats: AchievementStats;
  categoryProgress: Record<string, number>;
}

interface AchievementDashboardProps {
  data: AchievementResponse;
  username: string;
}

const rarityColors = {
  BRONZE: 'bg-amber-600',
  SILVER: 'bg-gray-400',
  GOLD: 'bg-yellow-500',
  DIAMOND: 'bg-blue-500'
};

const rarityIcons = {
  BRONZE: Medal,
  SILVER: Award,
  GOLD: Crown,
  DIAMOND: Star
};

const categoryColors = {
  RECENT_ACTIVITY: 'bg-blue-500',
  YEAR_LONG: 'bg-purple-500',
  REPOSITORY: 'bg-green-500'
};

const categoryIcons = {
  RECENT_ACTIVITY: Zap,
  YEAR_LONG: Calendar,
  REPOSITORY: Target
};

export default function AchievementDashboard({ data, username }: AchievementDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'progress' | 'rarity' | 'name'>('progress');

  const filteredAchievements = useMemo(() => {
    let filtered = data.achievements;
    
    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(achievement => achievement.category === selectedCategory);
    }

    // Sort achievements
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          return b.percentage - a.percentage;
        case 'rarity':
          const rarityOrder = { DIAMOND: 4, GOLD: 3, SILVER: 2, BRONZE: 1 };
          return rarityOrder[b.rarity as keyof typeof rarityOrder] - rarityOrder[a.rarity as keyof typeof rarityOrder];
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [data.achievements, selectedCategory, sortBy]);

  const unlockedAchievements = data.achievements.filter(a => a.unlocked);
  const lockedAchievements = data.achievements.filter(a => !a.unlocked);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getProgressTextColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-500';
    if (percentage >= 75) return 'text-blue-500';
    if (percentage >= 50) return 'text-yellow-500';
    if (percentage >= 25) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5" />
              Total Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.stats.totalAchievements}</div>
            <p className="text-blue-100 text-sm">Available to unlock</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5" />
              Unlocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.stats.unlockedAchievements}</div>
            <p className="text-green-100 text-sm">
              {((data.stats.unlockedAchievements / data.stats.totalAchievements) * 100).toFixed(1)}% complete
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" />
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.stats.overallProgress.toFixed(1)}%</div>
            <p className="text-purple-100 text-sm">Average across all achievements</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Recent Unlock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{data.stats.mostRecentAchievement}</div>
            <p className="text-orange-100 text-sm">Latest achievement earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Category Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(data.categoryProgress).map(([category, count]) => {
              const Icon = categoryIcons[category as keyof typeof categoryIcons];
              const color = categoryColors[category as keyof typeof categoryColors];
              const achievements = data.achievements.filter(a => a.category === category);
              const unlocked = achievements.filter(a => a.unlocked).length;
              const progress = (unlocked / count) * 100;

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{category.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        {unlocked}/{count} unlocked
                      </p>
                    </div>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === 'ALL' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('ALL')}
            size="sm"
          >
            All ({data.achievements.length})
          </Button>
          {Object.keys(data.categoryProgress).map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category)}
              size="sm"
            >
              {category.replace('_', ' ')} ({data.categoryProgress[category]})
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'progress' | 'rarity' | 'name')}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="progress">Progress</option>
            <option value="rarity">Rarity</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAchievements.map((achievement) => {
          const RarityIcon = rarityIcons[achievement.rarity as keyof typeof rarityIcons];
          const isUnlocked = achievement.unlocked;
          const progressColor = getProgressColor(achievement.percentage);
          const progressTextColor = getProgressTextColor(achievement.percentage);

          return (
            <Card
              key={achievement.id}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                isUnlocked 
                  ? 'ring-2 ring-green-500 bg-gradient-to-br from-green-50 to-green-100' 
                  : 'hover:scale-105'
              }`}
            >
              {/* Unlock Badge */}
              {isUnlocked && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Unlocked
                  </Badge>
                </div>
              )}

              {/* Rarity Badge */}
              <div className="absolute top-2 left-2 z-10">
                <Badge className={`${rarityColors[achievement.rarity as keyof typeof rarityColors]} text-white`}>
                  <RarityIcon className="h-3 w-3 mr-1" />
                  {achievement.rarity}
                </Badge>
              </div>

              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{achievement.icon}</div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{achievement.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {achievement.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Section */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {achievement.currentProgress}/{achievement.targetProgress}
                    </span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all duration-300 ease-in-out ${progressColor}`}
                      style={{ width: `${achievement.percentage}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <span className={`text-lg font-bold ${progressTextColor}`}>
                      {achievement.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Criteria Details */}
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Target: </span>
                    <span className="font-medium">{achievement.criteria.target}</span>
                    <span className="text-muted-foreground"> {achievement.criteria.type.replace('_', ' ').toLowerCase()}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Data Source: </span>
                    <Badge variant="outline" className="text-xs">
                      {achievement.criteria.dataSource.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Unlock Date */}
                {isUnlocked && achievement.unlockedDate && (
                  <div className="text-sm text-muted-foreground">
                    <span>Unlocked: {formatDate(achievement.unlockedDate)}</span>
                  </div>
                )}

                {/* Last Updated */}
                <div className="text-xs text-muted-foreground">
                  Last updated: {formatDate(achievement.lastUpdated)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredAchievements.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No achievements found</h3>
            <p className="text-muted-foreground">
              Try changing your filters or check back later for new achievements.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Achievement Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Achievement Summary for @{username}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Unlocked Achievements</h4>
              <div className="space-y-2">
                {unlockedAchievements.map(achievement => (
                  <div key={achievement.id} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">{achievement.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Unlocked {achievement.unlockedDate && formatDate(achievement.unlockedDate)}
                      </p>
                    </div>
                    <Badge className={rarityColors[achievement.rarity as keyof typeof rarityColors]}>
                      {achievement.rarity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Next Goals</h4>
              <div className="space-y-2">
                {lockedAchievements
                  .sort((a, b) => b.percentage - a.percentage)
                  .slice(0, 3)
                  .map(achievement => (
                    <div key={achievement.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="text-2xl opacity-50">{achievement.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">{achievement.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {achievement.currentProgress}/{achievement.targetProgress} ({achievement.percentage.toFixed(1)}%)
                        </p>
                      </div>
                      <Badge variant="outline" className={rarityColors[achievement.rarity as keyof typeof rarityColors]}>
                        {achievement.rarity}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 