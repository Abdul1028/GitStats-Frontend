'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from "next/image";
// Import Shadcn Card components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Assuming Button was added or is default
import { Input } from "@/components/ui/input";
// Import Chart components
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
  CartesianGrid,
  Sector,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting
import CalendarHeatmap from 'react-calendar-heatmap';
import type { ReactCalendarHeatmapValue } from 'react-calendar-heatmap'; // Import specific type
import { Tooltip as ReactTooltip } from 'react-tooltip'; // Import tooltip component
import 'react-calendar-heatmap/dist/styles.css'; // Import default heatmap styles

interface GitHubUser {
  login: string;
  avatarUrl: string | null;
  name: string | null;
  bio: string | null;
  createdAt: string | null;
  followers: number;
  following: number;
}

// Interface for Repository Data
interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  htmlUrl: string;
  stargazers_count: number;
  forks_count: number;
  created_at: string | null;
}

// Interface for Language Stats
type LanguageStats = Record<string, number>; // Simple map { languageName: count }

interface LanguageChartData {
  language: string;
  count: number;
  fill: string;
}

interface RepoChartData {
  name: string;
  stars: number;
}

interface ForkChartData {
    name: string;
    forks: number;
}

// Interface for GitHub Event
interface GitHubEvent {
    id: string;
    type: string;
    repo: {
        id: number;
        name: string;
    } | null; // Repo can be null for some events
    created_at: string; // Changed from createdAt
}

interface LoggedInUser {
    login: string;
    name?: string;
    avatarUrl?: string;
}

// Interface for Contribution Data (matching GraphQL response)
interface ContributionDay {
    contributionCount: number;
    date: string;
    weekday: number;
}

interface ContributionWeek {
    contributionDays: ContributionDay[];
}

interface ContributionCalendar {
    totalContributions: number;
    weeks: ContributionWeek[];
}

interface ContributionData {
    contributionCalendar: ContributionCalendar;
}

// Type for heatmap values array - MUST include date
type HeatmapValue = { date: string; count: number };

interface MonthlyContributionData {
    month: string;
    contributions: number;
}

interface EventTypeData {
    type: string;
    count: number;
    fill: string;
}

interface ActiveRepoData {
    name: string;
    events: number;
}

interface WeekdayContributionData {
    day: string; // e.g., "Sun", "Mon"
    contributions: number;
}

interface RepoAgeData {
    year: string; // e.g., "2024", "Older"
    count: number;
}

export default function Home() {
  const [username, setUsername] = useState<string>('');
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]); // State for repositories
  const [languageStats, setLanguageStats] = useState<LanguageStats | null>(null); // State for language stats
  const [events, setEvents] = useState<GitHubEvent[]>([]); // State for events
  const [contributionData, setContributionData] = useState<ContributionData | null>(null); // State for contributions
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true); // Loading state for initial auth check

  // Determine if we are showing data for the currently logged-in user
  const isFetchingLoggedInUser = !!loggedInUser;
  
  // --- Check auth status on initial load --- 
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        // Point fetch to the backend server and include credentials
        const response = await fetch('http://localhost:8080/api/user/me', {
          credentials: 'include' // Send cookies with the request
        }); 
        if (response.ok && response.status !== 204) { // 204 No Content means not logged in
          const user: LoggedInUser = await response.json();
          setLoggedInUser(user);
        } else {
          // Handle 401 or other non-ok statuses
          console.log("Auth check failed or not logged in, status:", response.status);
          setLoggedInUser(null);
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        setLoggedInUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []); // Empty dependency array runs once on mount

  const fetchData = async () => {
    // Use the component-scoped variable
    const targetUserLogin = isFetchingLoggedInUser ? loggedInUser?.login : username;

    if (!targetUserLogin) {
      setError('Please enter a GitHub username or log in.');
      return;
    }

    setLoading(true);
    setError(null);
    setUserData(null);
    setRepos([]);
    setLanguageStats(null);
    setEvents([]);
    setContributionData(null); // Clear previous contribution data

    try {
      // Fetch user data (use /api/user/me if logged in, otherwise /api/users/{username})
      const userUrl = isFetchingLoggedInUser 
        ? 'http://localhost:8080/api/user/me' 
        : `http://localhost:8080/api/users/${targetUserLogin}`;
      const userResponse = await fetch(userUrl, {
         // Send credentials ONLY if fetching logged-in user's own data
         credentials: isFetchingLoggedInUser ? 'include' : 'omit', 
      });
      if (!userResponse.ok || userResponse.status === 204) {
        const errorText = isFetchingLoggedInUser ? "Failed to fetch logged-in user data" : `User not found or API error for ${targetUserLogin}`;
        throw new Error(`${errorText} (Status: ${userResponse.status})`);
      }
      // Adapt user data structure if needed (assuming /api/user/me returns similar structure for display)
      const userDataJson: GitHubUser = await userResponse.json(); 
      setUserData(userDataJson); 

      // Fetch repository data (use /api/user/repos if logged in)
      const repoUrl = isFetchingLoggedInUser 
        ? 'http://localhost:8080/api/user/repos' 
        : `http://localhost:8080/api/users/${targetUserLogin}/repos`;
      const repoResponse = await fetch(repoUrl, { 
          credentials: isFetchingLoggedInUser ? 'include' : 'omit',
      });
      // Keep raw JSON logging for now
      const repoJsonText = await repoResponse.text(); 
      console.log("Raw Repo JSON Text:", repoJsonText); 
      if (repoResponse.ok) {
        try {
            const repoDataJson: GitHubRepo[] = JSON.parse(repoJsonText);
            setRepos(repoDataJson);
        } catch (parseError) {
            console.error("Failed to parse repo JSON:", parseError);
            setRepos([]); 
        }
      } else {
        console.warn(`Repo fetch warning: Status ${repoResponse.status}, Body: ${repoJsonText}`);
        setRepos([]);
      }

      // --- Fetch Language Stats (Based on fetched repos) --- 
      // Recalculate language stats based on the *actually fetched* repos
      // This requires moving the calculation logic here or fetching separately
      // Option 1: Fetch separately (simpler for now)
      const langUrl = isFetchingLoggedInUser
        ? 'http://localhost:8080/api/user/languages' // NEED TO CREATE THIS ENDPOINT
        : `http://localhost:8080/api/users/${targetUserLogin}/languages`;
      const langResponse = await fetch(langUrl, { credentials: isFetchingLoggedInUser ? 'include' : 'omit' });
      if (langResponse.ok) {
          const langDataJson: LanguageStats = await langResponse.json();
          setLanguageStats(langDataJson);
      } else {
          console.warn(`Language fetch warning: Status ${langResponse.status}`);
          setLanguageStats({});
      }

      // --- Fetch Events (Use public for searched, authenticated if logged in - requires new endpoint) --- 
      const eventsUrl = isFetchingLoggedInUser
          ? 'http://localhost:8080/api/user/events' // NEED TO CREATE THIS ENDPOINT
          : `http://localhost:8080/api/users/${targetUserLogin}/events`;
      const eventsResponse = await fetch(eventsUrl, { credentials: isFetchingLoggedInUser ? 'include' : 'omit' });
      if (eventsResponse.ok) {
          const eventsDataJson: GitHubEvent[] = await eventsResponse.json();
          setEvents(eventsDataJson);
      } else {
          console.warn(`Events fetch warning: Status ${eventsResponse.status}`);
          setEvents([]);
      }

      // Fetch data based on login status
      if (isFetchingLoggedInUser) {
         // --- Fetch Contribution Data (Only when logged in) --- 
        const contribResponse = await fetch('http://localhost:8080/api/user/contributions', {
            credentials: 'include'
        });
        if (!contribResponse.ok) {
            console.warn(`Contribution fetch warning: Status ${contribResponse.status}`);
            setContributionData(null); 
        } else {
            const contribDataJson: ContributionData = await contribResponse.json();
            setContributionData(contribDataJson);
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to fetch data.');
      console.error(err);
      setUserData(null); // Ensure user data is cleared on error
      setRepos([]);      // Ensure repo data is cleared on error
      setLanguageStats(null); // Clear stats on error
      setEvents([]); // Clear events on error
      setContributionData(null); // Clear on error
    } finally {
      setLoading(false);
    }
  };

  const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];
  const PIE_COLORS_EVENTS = ['#FF8042', '#FFBB28', '#00C49F', '#0088FE', '#8884D8', '#8dd1e1', '#a4de6c', '#d0ed57']; // Different set for events

  // Memoize chart data preparation to avoid recalculating on every render
  const { languageChartData, languageChartConfig } = useMemo(() => {
    const data: LanguageChartData[] = languageStats
      ? Object.entries(languageStats)
          .map(([key, value], index) => ({
            language: key,
            count: value,
            fill: PIE_COLORS[index % PIE_COLORS.length],
          }))
          .sort((a, b) => b.count - a.count)
      : [];

    const config: ChartConfig = data.reduce((acc, cur) => {
      acc[cur.language] = { // Use language name as the key
        label: cur.language, 
        color: cur.fill, 
      };
      return acc;
    }, {} as ChartConfig);
    
    // Add the main data key config
    config["count"] = { label: "Repositories" }; 

    return { languageChartData: data, languageChartConfig: config };
  }, [languageStats]); // Dependency array

  const { repoChartData, repoChartConfig } = useMemo(() => {
      const TOP_N_REPOS = 7;
      const sortedData = [...repos]
          .filter(repo => repo.stargazers_count > 0)
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
          .slice(0, TOP_N_REPOS)
          .map(repo => ({ name: repo.name, stars: repo.stargazers_count }))
          .reverse();

      const config = {
          stars: { 
              label: "Stars",
              color: "oklch(0.488 0.243 264.376)" 
          },
      } satisfies ChartConfig;
      return { repoChartData: sortedData, repoChartConfig: config };
  }, [repos]);

  // --- Prepare data for Top Forks Bar Chart --- 
  const { topForksChartData, topForksChartConfig } = useMemo(() => {
      const TOP_N_FORKS = 7;
      const sortedData = [...repos]
          .filter(repo => repo.forks_count > 0)
          .sort((a, b) => b.forks_count - a.forks_count)
          .slice(0, TOP_N_FORKS)
          .map(repo => ({ name: repo.name, forks: repo.forks_count }))
          .reverse();

      const config = {
          forks: {
              label: "Forks",
              color: "oklch(0.696 0.17 162.48)"
          },
      } satisfies ChartConfig;
      return { topForksChartData: sortedData, topForksChartConfig: config };
  }, [repos]);

  // --- Calculate Profile Insights --- 
  const insights = useMemo(() => {
    // Calculate distinct languages
    const distinctLanguages = languageStats ? Object.keys(languageStats).length : 0;

    let mostUsedLang: string | null = null;
    if (languageStats && Object.keys(languageStats).length > 0) {
      mostUsedLang = Object.entries(languageStats).sort(([, countA], [, countB]) => countB - countA)[0][0];
    }

    // Initialize explicitly before the loop
    let oldestRepo: GitHubRepo | null = null;
    let latestRepo: GitHubRepo | null = null;
    
    // --- Calculate Repo Stats (Oldest, Newest) --- 
    if (repos && repos.length > 0) {
        repos.forEach(repo => {
            if (repo.created_at) { 
                try {
                    const repoDate = new Date(repo.created_at);
                    if (isNaN(repoDate.getTime())) {
                        console.warn(`[Insights] Invalid date parsed for repo ${repo.name}:`, repo.created_at);
                        return; 
                    }

                    // Simplified assignment logic
                    if (!oldestRepo || repoDate < new Date(oldestRepo.created_at!)) {
                        oldestRepo = repo;
                    }
                    if (!latestRepo || repoDate > new Date(latestRepo.created_at!)) {
                        latestRepo = repo;
                    }
                } catch (e) {
                    console.error(`[Insights] Error processing date for repo ${repo.name}:`, repo.created_at, e);
                }
            }
        });
    }
    // --- End Repo Stats --- 

    // --- Calculate Contribution Stats --- 
    let longestStreak = 0;
    let currentStreak = 0;
    let busiestDay = { date: 'N/A', count: 0 };
    const contributionsByMonth: Record<string, number> = {};
    const contributionsByWeekday: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let totalContributions = 0;
    let activeDays = 0;

    if (contributionData?.contributionCalendar?.weeks) {
        totalContributions = contributionData.contributionCalendar.totalContributions;
        let maxContributions = -1;
        const allDays = contributionData.contributionCalendar.weeks
            .flatMap(week => week.contributionDays)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const day of allDays) {
            // Busiest Day
            if (day.contributionCount > maxContributions) {
                maxContributions = day.contributionCount;
                busiestDay = { date: day.date, count: day.contributionCount };
            }
            // Streak
            if (day.contributionCount > 0) {
                activeDays++; // Increment active days count
                currentStreak++;
            } else {
                if (currentStreak > longestStreak) {
                    longestStreak = currentStreak;
                }
                currentStreak = 0;
            }
            // Contributions per Month
            const monthKey = day.date.substring(0, 7); // YYYY-MM
            contributionsByMonth[monthKey] = (contributionsByMonth[monthKey] || 0) + day.contributionCount;
            
            // Contributions per Weekday
            if (day.weekday >= 0 && day.weekday <= 6) { // Ensure weekday is valid
               contributionsByWeekday[day.weekday] = (contributionsByWeekday[day.weekday] || 0) + day.contributionCount;
            }
        }
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
        }
    }

    // Calculate consistency and average per active day
    const contributionConsistency = contributionData ? (activeDays / 365.0) * 100 : 0; // Approx percentage
    const avgContributionsPerActiveDay = activeDays > 0 ? totalContributions / activeDays : 0;

    // Find Busiest Month
    let busiestMonth = { month: 'N/A', count: 0 };
    let maxMonthContributions = -1;
    for (const [month, count] of Object.entries(contributionsByMonth)) {
        if (count > maxMonthContributions) {
            maxMonthContributions = count;
            busiestMonth = { month: month, count: count };
        }
    }

    // Find Busiest Weekday
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let busiestWeekday = { day: 'N/A', count: 0 };
    let maxWeekdayContributions = -1;
    for (const [dayIndex, count] of Object.entries(contributionsByWeekday)) {
        const numericDayIndex = parseInt(dayIndex, 10);
        if (count > maxWeekdayContributions && numericDayIndex >= 0 && numericDayIndex <= 6) {
            maxWeekdayContributions = count;
            busiestWeekday = { day: weekdays[numericDayIndex], count: count };
        }
    }
    // --- End Contribution Stats --- 

    // --- Calculate Repo Averages --- 
    let avgStars = 0;
    let avgForks = 0;
    if (repos && repos.length > 0) {
        const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
        avgStars = totalStars / repos.length;
        avgForks = totalForks / repos.length;
    }
    // --- End Repo Averages --- 

    return { 
        mostUsedLang, 
        oldestRepo, 
        latestRepo, 
        longestStreak, 
        busiestDay,
        busiestMonth,  
        busiestWeekday, 
        avgStars, 
        avgForks,  
        distinctLanguages,
        contributionConsistency,
        avgContributionsPerActiveDay,
        activeDays
    };

  }, [languageStats, repos, contributionData, userData]);

  // Destructure all insights including the new ones AND activeDays
  const { 
      mostUsedLang, oldestRepo, latestRepo, longestStreak, busiestDay, 
      busiestMonth, busiestWeekday, avgStars, avgForks, 
      distinctLanguages, contributionConsistency, avgContributionsPerActiveDay, 
      activeDays
  } = insights;

  // --- Prepare data for Heatmap --- 
  const heatmapValues: HeatmapValue[] = useMemo(() => {
    if (!contributionData?.contributionCalendar?.weeks) return [];
    return contributionData.contributionCalendar.weeks.flatMap(week => 
        week.contributionDays.map(day => ({
            date: day.date,
            count: day.contributionCount
        }))
    );
  }, [contributionData]);

  // Create a map for quick count lookup by date
  const heatmapValueMap = useMemo(() => {
    const map = new Map<string, number>();
    heatmapValues.forEach(v => map.set(v.date, v.count));
    return map;
  }, [heatmapValues]);

  // Adjust function signatures to accept the expected type and lookup count
  const getClassForValue = (value: ReactCalendarHeatmapValue<string> | undefined): string => {
    const count = value?.date ? (heatmapValueMap.get(value.date) ?? 0) : 0;
    if (count === 0) return 'color-empty';
    if (count <= 2) return 'color-scale-0'; 
    if (count <= 5) return 'color-scale-1';
    if (count <= 10) return 'color-scale-2';
    return 'color-scale-3';
  };

  // Calculate start and end dates for the heatmap (approx last year)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);

  // --- Prepare data for Monthly Contribution Chart --- 
  const { monthlyContributionData, monthlyContributionConfig } = useMemo(() => {
    const contributionsByMonth: Record<string, number> = {}; 
    if (contributionData?.contributionCalendar?.weeks) {
        contributionData.contributionCalendar.weeks
            .flatMap(week => week.contributionDays)
            .forEach(day => {
                const monthKey = day.date.substring(0, 7); // YYYY-MM
                contributionsByMonth[monthKey] = (contributionsByMonth[monthKey] || 0) + day.contributionCount;
            });
    }
    
    const data: MonthlyContributionData[] = Object.entries(contributionsByMonth)
        .map(([month, count]) => ({ month, contributions: count }))
        .sort((a, b) => a.month.localeCompare(b.month)); // Sort chronologically

    const config = {
        contributions: { label: "Contributions", color: "hsl(var(--chart-3))" },
    } satisfies ChartConfig;

    return { monthlyContributionData: data, monthlyContributionConfig: config };
  }, [contributionData]);

  // --- Prepare data for Event Type Breakdown Pie Chart --- 
  const { eventTypeChartData, eventTypeChartConfig } = useMemo(() => {
    const eventCounts: Record<string, number> = {};
    events.forEach(event => {
        const type = event.type.replace('Event', ''); // Clean up type name
        eventCounts[type] = (eventCounts[type] || 0) + 1;
    });

    const data: EventTypeData[] = Object.entries(eventCounts)
        .map(([type, count], index) => ({
            type,
            count,
            fill: PIE_COLORS_EVENTS[index % PIE_COLORS_EVENTS.length],
        }))
        .sort((a, b) => b.count - a.count); // Sort by count descending

    const config: ChartConfig = data.reduce((acc, cur) => {
        acc[cur.type] = { label: cur.type, color: cur.fill };
        return acc;
    }, {} as ChartConfig);
    config["count"] = { label: "Events" }; // Add main data key label

    return { eventTypeChartData: data, eventTypeChartConfig: config };
  }, [events]);

  // --- Prepare data for Most Active Repositories Bar Chart --- 
  const { activeRepoChartData, activeRepoChartConfig } = useMemo(() => {
    const TOP_N_ACTIVE_REPOS = 7;
    const repoEventCounts: Record<string, number> = {};
    events.forEach(event => {
        if (event.repo?.name) { // Ensure repo name exists
            repoEventCounts[event.repo.name] = (repoEventCounts[event.repo.name] || 0) + 1;
        }
    });

    const data: ActiveRepoData[] = Object.entries(repoEventCounts)
        .map(([name, count]) => ({ name: name, events: count }))
        .sort((a, b) => b.events - a.events)
        .slice(0, TOP_N_ACTIVE_REPOS)
        .reverse(); // Reverse for vertical bar chart display (smallest at bottom)

    const config = {
        events: {
            label: "Events",
            color: "var(--color-event-activity)", // Use the new CSS variable
        },
    } satisfies ChartConfig;
    return { activeRepoChartData: data, activeRepoChartConfig: config };
  }, [events]);

  // --- Prepare data for Contributions per Weekday Chart --- 
  const { weekdayContributionChartData, weekdayContributionChartConfig } = useMemo(() => {
    // Calculate contributionsByWeekday (same logic as in insights hook)
    const contributionsByWeekday: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; 
    if (contributionData?.contributionCalendar?.weeks) {
        contributionData.contributionCalendar.weeks
            .flatMap(week => week.contributionDays)
            .forEach(day => {
                contributionsByWeekday[day.weekday] = (contributionsByWeekday[day.weekday] || 0) + day.contributionCount;
            });
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const data: WeekdayContributionData[] = Object.entries(contributionsByWeekday)
        .map(([dayIndex, count]) => ({
            day: dayNames[parseInt(dayIndex, 10)],
            contributions: count
        }));
    // Keep original Sun-Sat order

    const config = {
        contributions: {
            label: "Contributions",
            color: "var(--color-contributions)", // Reuse contributions color
        },
    } satisfies ChartConfig;
    
    return { weekdayContributionChartData: data, weekdayContributionChartConfig: config };

  }, [contributionData]);

  // --- Prepare data for Repository Age Distribution --- 
  const { repoAgeChartData, repoAgeChartConfig } = useMemo(() => {
    console.log("[RepoAge] Calculating - Input Repos:", repos); // Log input
    const countByYear: Record<string, number> = {};

    repos.forEach((repo, index) => {
        if (index < 5) { 
            console.log(`[RepoAge] Repo ${index} (${repo.name}) created_at:`, repo.created_at);
        }
        if (repo.created_at) {
            try {
                const year = String(new Date(repo.created_at).getFullYear());
                countByYear[year] = (countByYear[year] || 0) + 1;
            } catch (e) {
                console.error("[RepoAge] Error parsing repo creation date:", repo.created_at, e);
            }
        } else {
             console.warn(`[RepoAge] Repo ${repo.name} has missing created_at date.`);
        }
    });

    console.log("[RepoAge] Intermediate countByYear:", countByYear);
    const data: RepoAgeData[] = Object.entries(countByYear)
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
    console.log("[RepoAge] Final repoAgeChartData:", data);

    const config = {
        count: {
            label: "Repositories",
            color: "var(--color-repo-age)", // Use the existing color
        },
    } satisfies ChartConfig;
    return { repoAgeChartData: data, repoAgeChartConfig: config };
  }, [repos]);

  const handleLogout = () => {
    // Point to the backend logout URL
    window.location.href = 'http://localhost:8080/logout'; 
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-gray-900 text-white">
      <div className="w-full max-w-6xl">
        {/* --- Header & Login/Logout --- */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-4xl font-bold mb-0 sm:mb-2">GitStats</h1>
            <p className="text-lg text-gray-400 hidden sm:block">GitHub Profile Analysis</p>
          </div>
          <div className="flex items-center gap-3 min-h-[40px]">
            {authLoading === true ? (
              <span className="text-sm text-gray-500">Checking auth...</span>
            ) : loggedInUser !== null ? (
              <>
                <span className="text-sm">Logged in as <strong className="text-white">{loggedInUser.login}</strong></span>
                {loggedInUser.avatarUrl && 
                  <Image src={loggedInUser.avatarUrl} alt="User Avatar" width={32} height={32} className="rounded-full" />
                }
                <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" asChild>
                <a href="http://localhost:8080/oauth2/authorization/github">Login with GitHub</a>
              </Button>
            )}
          </div>
        </div>

        {/* --- Search Input --- */}
        <div className="flex gap-2 mb-10 w-full max-w-md mx-auto">
            <Input
                type="text"
                value={isFetchingLoggedInUser ? loggedInUser?.login || '' : username} 
                onChange={(e) => !isFetchingLoggedInUser && setUsername(e.target.value)}
                placeholder="Enter GitHub username or Login"
                disabled={isFetchingLoggedInUser} 
            />
            <Button onClick={fetchData} disabled={loading || (isFetchingLoggedInUser && !loggedInUser)}>
                {loading ? 'Loading...' : (isFetchingLoggedInUser ? 'Fetch My Stats' : 'Fetch Stats')}
            </Button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-800 text-red-100 border border-red-600 rounded-lg w-full max-w-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {userData && (() => {
          let formattedDate = 'Invalid Date';
          try {
            if (userData.createdAt) {
              formattedDate = new Date(userData.createdAt).toLocaleDateString();
            }
          } catch (e) { console.error('Error parsing date:', e); }

          return (
            <Card className="mt-8 w-full max-w-2xl bg-gray-800 border-gray-700 text-white">
              <CardHeader className="flex flex-col items-center text-center">
                {userData.avatarUrl && (
                  <Image
                    src={userData.avatarUrl}
                    alt={`${userData.login}'s avatar`}
                    width={128}
                    height={128}
                    className="rounded-full mb-4 border-4 border-gray-600"
                    priority
                  />
                )}
                <CardTitle className="text-3xl font-bold">{userData.name || userData.login}</CardTitle>
                {userData.name && <CardDescription className="text-gray-400">@{userData.login}</CardDescription>}
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-300 mb-4 max-w-lg mx-auto">{userData.bio || 'No bio provided.'}</p>
                <div className="flex justify-center gap-6 text-lg text-gray-400">
                  <span>Followers: <strong className="text-white">{userData.followers}</strong></span>
                  <span>Following: <strong className="text-white">{userData.following}</strong></span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-center text-sm text-gray-500">
                <p>Joined GitHub on: {formattedDate}</p>
              </CardFooter>
            </Card>
          );
        })()}

        {/* --- Main Content Area (Profile + Charts) --- */}
        {userData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            {/* Charts Area (takes 2 columns on large screens) */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Language Usage Pie Chart */}
              {languageChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                  <h2 className="text-2xl font-semibold mb-4 text-center">Language Usage</h2>
                  <Card className="bg-gray-800 border-gray-700 text-white p-4 flex flex-col items-center">
                    <CardContent className="w-full h-[250px] p-0 mt-4">
                      <ChartContainer config={languageChartConfig} className="w-full h-full aspect-square mx-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent indicator="dot" hideLabel />}
                            />
                            <Pie
                              data={languageChartData}
                              dataKey="count"
                              nameKey="language"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              innerRadius={50}
                              strokeWidth={2}
                              activeShape={({ outerRadius = 0, ...props }: any) => (
                                <Sector {...props} outerRadius={outerRadius + 6} />
                              )}
                            >
                              {languageChartData.map((entry) => (
                                <Cell key={`cell-${entry.language}`} fill={entry.fill} name={entry.language}/>
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Top Repositories by Stars - Refined Styling */}
              {repoChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                    <h2 className="text-2xl font-semibold mb-4 text-center">Top Repositories by Stars</h2>
                    <Card className="bg-gray-800 border-gray-700 text-white">
                        <CardContent className="p-4 pl-2 pr-6 pt-4">
                            <ChartContainer config={repoChartConfig} className="w-full h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={repoChartData} 
                                        layout="vertical" 
                                        margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                                    > 
                                        <XAxis type="number" hide /> 
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                            tickMargin={5}
                                            width={80}
                                        />
                                        <ChartTooltip 
                                            cursor={false} 
                                            content={<ChartTooltipContent indicator="line" hideLabel />} 
                                        />
                                        <Bar dataKey="stars" layout="vertical" radius={6} fill="oklch(0.488 0.243 264.376)"> 
                                            <LabelList 
                                                dataKey="stars"
                                                position="right" 
                                                offset={8} 
                                                fill="#FFFFFF"
                                                fontSize={11}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
              )}

              {/* Top Repositories by Forks - Refined Styling */}
              {topForksChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                    <h2 className="text-2xl font-semibold mb-4 text-center">Top Repositories by Forks</h2>
                    <Card className="bg-gray-800 border-gray-700 text-white">
                        <CardContent className="p-4 pl-2 pr-6 pt-4">
                            <ChartContainer config={topForksChartConfig} className="w-full h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={topForksChartData} 
                                        layout="vertical" 
                                        margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                                    > 
                                        <XAxis type="number" hide /> 
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                            tickMargin={5}
                                            width={80}
                                        />
                                        <ChartTooltip 
                                            cursor={false} 
                                            content={<ChartTooltipContent indicator="line" hideLabel />} 
                                        />
                                        <Bar dataKey="forks" layout="vertical" radius={6} fill="oklch(0.696 0.17 162.48)">
                                            <LabelList 
                                                dataKey="forks"
                                                position="right" 
                                                offset={8} 
                                                fill="#FFFFFF"
                                                fontSize={11}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
              )}

              {/* --- Event Type Breakdown Pie Chart --- */}
              {eventTypeChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                  <h2 className="text-2xl font-semibold mb-1 text-center">Event Type Breakdown</h2>
                  <p className="text-sm text-muted-foreground text-center mb-3">(Based on recent events, approx. last 90 days)</p>
                  <Card className="bg-gray-800 border-gray-700 text-white p-4 flex flex-col items-center">
                    <CardContent className="w-full h-[250px] p-0 mt-4">
                      <ChartContainer config={eventTypeChartConfig} className="w-full h-full aspect-square mx-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent indicator="dot" hideLabel nameKey="type" />}
                            />
                            <Pie
                              data={eventTypeChartData}
                              dataKey="count"
                              nameKey="type" 
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={40}
                              strokeWidth={2}
                              activeShape={({ outerRadius = 0, ...props }: any) => (
                                <Sector {...props} outerRadius={outerRadius + 6} />
                              )}
                            >
                              {eventTypeChartData.map((entry) => (
                                <Cell key={`cell-${entry.type}`} fill={entry.fill} name={entry.type}/>
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* --- Most Active Repositories Bar Chart --- */}
              {activeRepoChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                  <h2 className="text-2xl font-semibold mb-1 text-center">Most Active Repositories</h2>
                  <p className="text-sm text-muted-foreground text-center mb-3">(Based on recent events, approx. last 90 days)</p>
                  <Card className="bg-gray-800 border-gray-700 text-white">
                      <CardContent className="p-4 pl-2 pr-6 pt-4">
                          <ChartContainer config={activeRepoChartConfig} className="w-full h-[300px]">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart 
                                      data={activeRepoChartData} 
                                      layout="vertical" 
                                      margin={{ left: 20, right: 30, top: 5, bottom: 5 }}
                                  > 
                                      <XAxis type="number" hide /> 
                                      <YAxis 
                                          dataKey="name" 
                                          type="category" 
                                          tickLine={false} 
                                          axisLine={false} 
                                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                          tickMargin={5}
                                          width={150}
                                      />
                                      <ChartTooltip 
                                          cursor={false} 
                                          content={<ChartTooltipContent indicator="line" hideLabel />}
                                      />
                                      <Bar dataKey="events" layout="vertical" radius={4} fill="var(--color-event-activity)">
                                          <LabelList 
                                              dataKey="events"
                                              position="right" 
                                              offset={8} 
                                              fill="#FFFFFF" 
                                              fontSize={11}
                                          />
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          </ChartContainer>
                      </CardContent>
                  </Card>
                </div>
              )}

              {/* --- Contributions per Weekday --- */}
              {weekdayContributionChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                   <h2 className="text-2xl font-semibold mb-1 text-center">Contributions per Weekday</h2>
                   <p className="text-sm text-muted-foreground text-center mb-3">(Last Year)</p>
                  <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardContent className="p-4 pl-2 pr-6 pt-4">
                      <ChartContainer config={weekdayContributionChartConfig} className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weekdayContributionChartData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="day"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            />
                            <YAxis hide />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent 
                                                  className="bg-popover text-popover-foreground border rounded-md shadow-md p-2"
                                                  formatter={(value, name, item) => `${value} contributions on ${item.payload.day}s`}
                                                  indicator="line"
                                                  hideLabel
                                              />}
                            />
                            <Bar dataKey="contributions" radius={4} fill="var(--color-contributions)">
                              <LabelList
                                position="top"
                                offset={6}
                                fill="#FFFFFF"
                                fontSize={11}
                                formatter={(value: number) => value > 0 ? value : ''}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* --- Repository Age Distribution --- */}
              {repoAgeChartData.length > 0 && (
                <div className="w-full md:col-span-1">
                   <h2 className="text-2xl font-semibold mb-1 text-center">Repository Age Distribution</h2>
                   <p className="text-sm text-muted-foreground text-center mb-3">(Based on creation date)</p>
                  <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardContent className="p-4 pl-2 pr-6 pt-4">
                      <ChartContainer config={repoAgeChartConfig} className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={repoAgeChartData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="year"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            />
                            <YAxis hide />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent 
                                                  className="bg-popover text-popover-foreground border rounded-md shadow-md p-2"
                                                  formatter={(value, name, item) => `${value} repositories created in ${item.payload.year}`}
                                                  indicator="line"
                                                  hideLabel
                                              />}
                            />
                            <Bar dataKey="count" radius={4} fill="var(--color-repo-age)">
                              <LabelList
                                position="top"
                                offset={6}
                                fill="#FFFFFF"
                                fontSize={11}
                                formatter={(value: number) => value > 0 ? value : ''}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Contribution Heatmap Section (Only when logged in) --- */}
        {loggedInUser && contributionData && heatmapValues.length > 0 && (
             <div className="mt-10 w-full max-w-5xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-center">
                    {contributionData.contributionCalendar.totalContributions} contributions in the last year
                </h2>
                <Card className="bg-gray-800 border-gray-700 text-white p-6 overflow-x-auto">
                    <CalendarHeatmap
                        startDate={startDate}
                        endDate={endDate}
                        values={heatmapValues}
                        classForValue={getClassForValue}
                        tooltipDataAttrs={(value: ReactCalendarHeatmapValue<string> | undefined): any => { 
                            const dateStr = value?.date ? new Date(value.date).toDateString() : 'Unknown date';
                            const count = value?.date ? (heatmapValueMap.get(value.date) ?? 0) : 0;
                            return {
                                'data-tooltip-id': 'heatmap-tooltip', 
                                'data-tooltip-content': `${count} contributions on ${dateStr}`,
                            };
                        }}
                        showWeekdayLabels={true}
                        weekdayLabels={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']} 
                    />
                    <ReactTooltip id="heatmap-tooltip" />
                </Card>
            </div>
        )}

        {/* --- Monthly Contributions Chart - Refined Styling --- */}
        {loggedInUser && monthlyContributionData.length > 0 && (
            <div className="mt-10 w-full max-w-5xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-center">Monthly Contributions</h2>
                <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardContent className="p-4 pl-2 pr-6 pt-4">
                        <ChartContainer config={monthlyContributionConfig} className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                    data={monthlyContributionData} 
                                    margin={{ top: 20, right: 10, left: 0, bottom: 0 }} 
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis 
                                        dataKey="month"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => { 
                                            const date = new Date(value + '-02'); 
                                            return date.toLocaleString('default', { month: 'short' });
                                        }}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12}}
                                    />
                                    <YAxis hide /> 
                                    <ChartTooltip 
                                        cursor={false} 
                                        content={<ChartTooltipContent 
                                                    className="bg-popover text-popover-foreground border rounded-md shadow-md p-2"
                                                    formatter={(value, name, item) => {
                                                        const date = new Date(item.payload.month + '-02');
                                                        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                                                        return `${value} contributions in ${monthYear}`;
                                                    }}
                                                    indicator="line" 
                                                    hideLabel
                                                />}
                                    />
                                    <Bar dataKey="contributions" radius={8} fill="var(--color-contributions)">
                                        <LabelList 
                                            position="top" 
                                            offset={12}
                                            fill="#FFFFFF"
                                            fontSize={11}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* --- Profile Insights Section --- */}
        {userData && (mostUsedLang || oldestRepo || longestStreak > 0 || distinctLanguages > 0) && (
            <div className="lg:col-span-1">
                 <h2 className="text-2xl font-semibold mb-4 text-center">Profile Insights</h2>
                 <Card className="bg-gray-800 border-gray-700 text-white p-4">
                     <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 text-center">
                         {mostUsedLang && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Top Language</p>
                                 <p className="font-bold text-lg">{mostUsedLang}</p>
                             </div>
                         )}
                         {oldestRepo && oldestRepo.created_at && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Oldest Repository</p>
                                 <p className="font-semibold truncate" title={oldestRepo.name}>{oldestRepo.name}</p>
                                 <p className="text-xs text-gray-500">({new Date(oldestRepo.created_at).toLocaleDateString()})</p>
                             </div>
                         )}
                         {latestRepo && latestRepo.created_at && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Latest Repository</p>
                                 <p className="font-semibold truncate" title={latestRepo.name}>{latestRepo.name}</p>
                                 <p className="text-xs text-gray-500">({new Date(latestRepo.created_at).toLocaleDateString()})</p>
                             </div>
                         )}
                         {longestStreak > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Longest Streak</p>
                                 <p className="font-bold text-lg">{longestStreak} day{longestStreak > 1 ? 's' : ''}</p>
                             </div>
                         )}
                         {busiestDay && busiestDay.count > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Busiest Day</p>
                                 <p className="font-bold text-lg">{busiestDay.count} contributions</p>
                                 <p className="text-xs text-gray-500">({new Date(busiestDay.date).toLocaleDateString()})</p>
                             </div>
                         )}
                         {busiestMonth && busiestMonth.count > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Busiest Month</p>
                                 <p className="font-bold text-lg">{busiestMonth.count} contributions</p>
                                 <p className="text-xs text-gray-500">({new Date(busiestMonth.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })})</p>
                             </div>
                         )}
                         {busiestWeekday && busiestWeekday.count > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Busiest Day of Week</p>
                                 <p className="font-bold text-lg">{busiestWeekday.day}</p>
                                 <p className="text-xs text-gray-500">({insights.busiestWeekday.count} total contributions)</p>
                             </div>
                         )}
                         {repos.length > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Avg Stars / Repo</p>
                                 <p className="font-bold text-lg">{avgStars.toFixed(1)}</p>
                             </div>
                         )}
                         {repos.length > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Avg Forks / Repo</p>
                                 <p className="font-bold text-lg">{avgForks.toFixed(1)}</p>
                             </div>
                         )}
                         {distinctLanguages > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Distinct Languages</p>
                                 <p className="font-bold text-lg">{distinctLanguages}</p>
                             </div>
                         )}
                         {contributionData && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Contribution Consistency</p>
                                 <p className="font-bold text-lg">{contributionConsistency.toFixed(1)}%</p>
                                 <p className="text-xs text-gray-500">(Days active last year)</p>
                             </div>
                         )}
                         {contributionData && activeDays > 0 && (
                             <div className="p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400 mb-1">Avg Daily Contributions</p>
                                 <p className="font-bold text-lg">{avgContributionsPerActiveDay.toFixed(1)}</p>
                                 <p className="text-xs text-gray-500">(On active days)</p>
                             </div>
                         )}
                     </CardContent>
                 </Card>
            </div>
        )}

        {/* --- Recent Activity Section --- */}
        {events.length > 0 && (
            <div className="mt-10 w-full max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-center">Recent Activity</h2>
                <Card className="bg-gray-800 border-gray-700 text-white p-4">
                    <CardContent className="pt-4">
                        <ul className="space-y-3">
                            {events.slice(0, 10).map((event) => (
                                <li key={event.id} className="flex items-start space-x-3 bg-gray-800 p-3 rounded-md border border-gray-700">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">
                                            {event.type.replace('Event', '')} 
                                            {event.repo?.name && (
                                                <span className="text-gray-400"> in <span className="font-semibold text-gray-300 break-all">{event.repo.name}</span></span>
                                            )} 
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {(() => {
                                                try {
                                                    if (event.created_at && typeof event.created_at === 'string') {
                                                        const date = new Date(event.created_at);
                                                        if (!isNaN(date.getTime())) {
                                                            return formatDistanceToNow(date, { addSuffix: true });
                                                        }
                                                    }
                                                    console.warn("[Events] Invalid or missing created_at:", event.created_at);
                                                    return 'Invalid date';
                                                } catch (e) {
                                                    console.error("[Events] Error formatting event date:", e, "Raw value:", event.created_at);
                                                    return 'Error formatting date';
                                                }
                                            })()}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        )}

        {repos.length > 0 && (
          <div className="mt-8 w-full max-w-4xl">
            <h2 className="text-2xl font-semibold mb-4 text-center">Repositories ({repos.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {repos.map((repo) => {
                // Log the entire repo object
                console.log('Processing repo object:', repo);
                // Previous log for specific fields (can be removed if the object log works)
                // console.log(`Repo: ${repo.name}, Stars: ${repo.stargazers_count}, Forks: ${repo.forks_count}`);

                return (
                  <Card key={repo.id} className="bg-gray-800 border-gray-700 text-white flex flex-col justify-between">
                    <CardHeader>
                      <CardTitle className="text-lg break-words">
                        <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {repo.name}
                        </a>
                      </CardTitle>
                      <CardDescription className="text-gray-400 pt-1 h-16 overflow-hidden">
                        {repo.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-400">
                      {repo.language && <p>Language: <span className="font-semibold text-gray-300">{repo.language}</span></p>}
                      <p>Stars: <span className="font-semibold text-gray-300">{repo.stargazers_count}</span></p>
                      <p>Forks: <span className="font-semibold text-gray-300">{repo.forks_count}</span></p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
    </div>
    </main>
  );
}
