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
import { signIn, signOut, useSession } from "next-auth/react";
import DevDocsSection from '@/components/DevDocsSection';

interface GitHubUser {
  login: string;
  avatar_url: string | null;
  name: string | null;
  bio: string | null;
  created_at: string | null;
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
    avatar_url?: string;
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

// --- Add explicit type for insights --- 
interface ProfileInsights {
    mostUsedLang: string | null;
    oldestRepo: GitHubRepo | null;
    latestRepo: GitHubRepo | null;
    longestStreak: number;
    busiestDay: { date: string; count: number };
    busiestMonth: { month: string; count: number };
    busiestWeekday: { day: string; count: number };
    avgStars: number;
    avgForks: number;
    distinctLanguages: number;
    contributionConsistency: number;
    avgContributionsPerActiveDay: number;
    activeDays: number;
}

// Add a type for session to include accessToken
interface SessionWithToken {
  user?: any;
  accessToken?: string;
}

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const checkScreen = () => setIsSmall(window.innerWidth < 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);
  return isSmall;
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
  const [personaData, setPersonaData] = useState<any>(null); // State for persona analysis
  const { data: sessionData, status } = useSession();
  const session = sessionData as SessionWithToken;
  const accessToken = session?.accessToken;
  const loggedInUser = session?.user || null;
  const authLoading = status === "loading";
  const isSmallScreen = useIsSmallScreen();

  console.log("hey: ",process.env.NEXT_PUBLIC_BACKEND_URL)

  const fetchData = async (fetchLoggedInUserData = false) => {
    
    // Determine if we are ACTUALLY fetching the logged-in user's data based on intent AND login status
    const isFetchingSelf = fetchLoggedInUserData && loggedInUser;
    
    // Determine the target username
    const targetUserLogin = isFetchingSelf ? loggedInUser.name || loggedInUser.email : username;

    // Check if a target user is actually determined
    if (!targetUserLogin) {
      // Refine error message based on context
      if (fetchLoggedInUserData) {
          setError('You must be logged in to fetch your own stats.');
      } else {
          setError('Please enter a GitHub username.');
      }
      return;
    }

    setLoading(true);
    setError(null);
    // Clear previous data only if starting a new search/fetch
    // We might want to keep showing old data while loading new?
    // For now, clear everything for simplicity.
    setUserData(null); 
    setRepos([]);
    setLanguageStats(null);
    setEvents([]);
    setContributionData(null); 

    try {
      // Fetch user data based on isFetchingSelf
      const userUrl = isFetchingSelf 
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/me` 
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${targetUserLogin}`;
      const userResponse = await fetch(userUrl, {
        headers: isFetchingSelf && accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!userResponse.ok || userResponse.status === 204) {
        const errorText = isFetchingSelf ? "Failed to fetch your logged-in user data" : `User not found or API error for ${targetUserLogin}`;
        throw new Error(`${errorText} (Status: ${userResponse.status})`);
      }
      const userDataJson: GitHubUser = await userResponse.json(); 
      setUserData(userDataJson); 

      // Fetch repository data based on isFetchingSelf
      const repoUrl = isFetchingSelf 
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/repos` 
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${targetUserLogin}/repos`;
      const repoResponse = await fetch(repoUrl, {
        headers: isFetchingSelf && accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
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

      // Fetch Language Stats based on isFetchingSelf
      const langUrl = isFetchingSelf
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/languages` 
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${targetUserLogin}/languages`;
      const langResponse = await fetch(langUrl, { headers: isFetchingSelf && accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
      if (langResponse.ok) {
          const langDataJson: LanguageStats = await langResponse.json();
          setLanguageStats(langDataJson);
      } else {
          console.warn(`Language fetch warning: Status ${langResponse.status}`);
          setLanguageStats({});
      }

      // Fetch Events based on isFetchingSelf
      const eventsUrl = isFetchingSelf
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/events` 
          : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${targetUserLogin}/events`;
      const eventsResponse = await fetch(eventsUrl, { headers: isFetchingSelf && accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
      if (eventsResponse.ok) {
          const eventsDataJson: GitHubEvent[] = await eventsResponse.json();
          setEvents(eventsDataJson);
      } else {
          console.warn(`Events fetch warning: Status ${eventsResponse.status}`);
          setEvents([]);
      }

      // Fetch Contribution Data ONLY if fetching self
      if (isFetchingSelf) { 
        const contribResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/contributions`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!contribResponse.ok) {
            console.warn(`Contribution fetch warning: Status ${contribResponse.status}`);
            setContributionData(null); 
        } else {
            const contribDataJson: ContributionData = await contribResponse.json();
            setContributionData(contribDataJson);
        }
      } else {
        // Ensure contribution data is null if fetching other user
        setContributionData(null);
      }

      // Fetch Persona Analysis
      const personaUrl = isFetchingSelf 
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/persona`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${targetUserLogin}/persona`;
      
      try {
        const personaResponse = await fetch(personaUrl, {
          headers: isFetchingSelf && accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (personaResponse.ok) {
          const personaDataJson = await personaResponse.json();
          setPersonaData(personaDataJson);
        } else {
          console.warn(`Persona fetch warning: Status ${personaResponse.status}`);
          setPersonaData(null);
        }
      } catch (e) {
        console.warn('Failed to fetch persona data:', e);
        setPersonaData(null);
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
        .sort((a, b) => b.stargazers_count - a.stargazers_count) // Most at top
        .slice(0, TOP_N_REPOS)
        .map(repo => ({ name: repo.name, stars: repo.stargazers_count }));
    const config = {
        stars: { 
            label: "Stars",
            color: "oklch(0.488 0.243 264.376)" 
        },
    } satisfies ChartConfig;
    return { repoChartData: sortedData, repoChartConfig: config };
  }, [repos]);

  // --- Top Repositories by Forks ---
  const { topForksChartData, topForksChartConfig } = useMemo(() => {
    const TOP_N_FORKS = 7;
    const sortedData = [...repos]
        .filter(repo => repo.forks_count > 0)
        .sort((a, b) => b.forks_count - a.forks_count) // Most at top
        .slice(0, TOP_N_FORKS)
        .map(repo => ({ name: repo.name, forks: repo.forks_count }));
    const config = {
        forks: {
            label: "Forks",
            color: "oklch(0.696 0.17 162.48)"
        },
    } satisfies ChartConfig;
    return { topForksChartData: sortedData, topForksChartConfig: config };
  }, [repos]);

  // --- Calculate Profile Insights --- 
  const insights: ProfileInsights = useMemo(() => {
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

  // --- Prepare data for Daily Contribution Intensity --- 
  interface DailyIntensityData {
      range: string;
      count: number;
  }
  const { dailyIntensityData, dailyIntensityConfig } = useMemo(() => {
    if (!contributionData?.contributionCalendar?.weeks) {
        return { dailyIntensityData: [], dailyIntensityConfig: {} };
    }

    const buckets: Record<string, number> = {
        "0": 0,
        "1-2": 0,
        "3-5": 0,
        "6-10": 0,
        "11-15": 0,
        "16+": 0,
    };
    const bucketOrder = ["0", "1-2", "3-5", "6-10", "11-15", "16+"];

    contributionData.contributionCalendar.weeks
        .flatMap(week => week.contributionDays)
        .forEach(day => {
            const count = day.contributionCount;
            if (count === 0) buckets["0"]++;
            else if (count <= 2) buckets["1-2"]++;
            else if (count <= 5) buckets["3-5"]++;
            else if (count <= 10) buckets["6-10"]++;
            else if (count <= 15) buckets["11-15"]++;
            else buckets["16+"]++;
        });

    const data: DailyIntensityData[] = bucketOrder.map(range => ({
        range,
        count: buckets[range],
    })).filter(item => item.count > 0); // Optionally filter out ranges with 0 days

    const config = {
        count: {
            label: "Days",
            color: "hsl(var(--chart-4))", // Use a different chart color
        },
        range: {
            label: "Contributions per Day",
            color: "hsl(var(--background))", // For inside label
        }
    } satisfies ChartConfig;

    return { dailyIntensityData: data, dailyIntensityConfig: config };

  }, [contributionData]);

  // Custom tick renderer for YAxis: render repo names at a -35 degree angle
  const renderRepoNameTick = (props: any) => {
    const { x, y, payload } = props;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          textAnchor="end"
          fontSize={14}
          fontWeight={500}
          fill="hsl(var(--muted-foreground))"
          transform="rotate(-35)"
          dy={4}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-gray-900 text-white">
      {/* Container with max-width and centered */}
      <div className="w-full max-w-7xl mx-auto">
        
        {/* --- Navbar --- */}
        <nav className="sticky top-6 z-50 w-full bg-gray-800/50 backdrop-blur-lg rounded-lg shadow-lg mb-12 px-4 py-4 border-b border-gray-700/50 flex justify-between items-center">
          {/* Brand Name with hover effect */}
          <h1 className="text-2xl font-bold text-white hover:text-teal-400 transition-colors duration-200">Gitlysis</h1>
          
          {/* Login/User Info Area */}
          <div className="flex items-center gap-3 min-h-[40px]">
            {authLoading ? (
              <span className="text-sm text-gray-500">Checking auth...</span>
            ) : loggedInUser ? (
              <>
                <span className="text-sm">Logged in as <strong className="text-white">{loggedInUser.name || loggedInUser.email}</strong></span>
                {loggedInUser.image && (
                  <Image src={loggedInUser.image} alt="User Avatar" width={32} height={32} className="rounded-full" />
                )}
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => signOut()}>Logout</Button>
              </>
            ) : (
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 flex items-center gap-2" onClick={() => signIn("github")}> 
                {/* GitHub Icon SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.11-.83-.16 0-.24.05-.02.13.28.08.62.61.78.83.26.31.75.75 1.88.75.23 0 .44-.01.66-.05 0 .46.01.9.01 1.18 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                </svg>
                Login with GitHub
              </Button>
            )}
          </div>
        </nav>

        {/* --- Loading State --- */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <p className="text-2xl text-gray-400 animate-pulse">Fetching GitHub data...</p> 
          </div>
        )}

        {/* --- Initial Hero/Welcome Section & Input --- */}
        {!loading && !userData && !error && (
          <div className="text-center py-12 sm:py-16">
            {/* --- Input Area Moved Up --- */}
            <p className="text-lg text-gray-400 mb-6">Enter a GitHub username below to get started:</p>
            <div className="flex gap-2 w-full max-w-lg mx-auto">
                <Input
                    type="text"
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="e.g., octocat"
                    className="h-12 text-lg px-4 flex-grow bg-gray-700 border-gray-600 placeholder-gray-500 focus:ring-offset-gray-900 focus:border-teal-500 focus:ring-teal-500" 
                />
                <Button 
                  onClick={() => fetchData()} 
                  disabled={loading || !username} 
                  className="h-12 px-6 text-lg bg-teal-600 hover:bg-teal-700" 
                >
                  Fetch Stats
                </Button>
            </div>
            {loggedInUser && (
              <p className="mt-4 text-gray-500">
                Welcome back, <strong className="text-gray-300">{loggedInUser.name || loggedInUser.email}</strong>! Click \
                <Button variant="link" className="p-0 px-1 h-auto align-baseline text-teal-400 hover:text-teal-300" onClick={() => fetchData(true)}>
                  Fetch My Stats
                </Button> \
                 to view your profile, or search for another user above.
              </p>
            )}

            {/* --- Responsive Discover + DevDocs Section --- */}
            <div className="mt-12 sm:mt-16 flex flex-col lg:flex-row items-stretch justify-center gap-8 w-full max-w-5xl mx-auto">
              <div className="flex-1 flex items-center">
                <Card className="w-full max-w-2xl mx-auto mb-0 bg-gray-800/50 border-gray-700/50 text-white">
                  <CardHeader>
                     <CardTitle className="text-xl tracking-normal font-semibold">What you can discover:</CardTitle>
                  </CardHeader>
                  <CardContent className="text-gray-300 text-left space-y-2 px-6 pb-6">
                      <ul className="list-disc list-outside pl-5 space-y-1 text-gray-400">
                        <li>Visualize your programming <span className="text-teal-400 font-medium">language usage</span> across repositories.</li>
                        <li>Identify your most popular projects by <span className="text-purple-400 font-medium">stars and forks</span>.</li>
                        <li>Analyze your <span className="text-green-400 font-medium">contribution patterns</span> with a detailed heatmap.</li>
                        <li>Uncover insights like coding streaks, busiest days, and repository age.</li>
                        <li>Track your recent activity and event types.</li>
                      </ul>
                  </CardContent>
                </Card>
              </div>
              <div className="flex-1 flex items-center">
                <DevDocsSection />
              </div>
            </div>
          </div>
        )}

        {/* --- Display fetched data (only when not loading and userData exists) --- */}
        {!loading && userData && (
          <>
            {/* --- User Profile Card --- */}
            {userData && (() => {
              let formattedDate = 'Invalid Date';
              try {
                if (userData.created_at) {
                  formattedDate = new Date(userData.created_at).toLocaleDateString();
                }
              } catch (e) { console.error('Error parsing date:', e); }

              return (
                <Card className="mt-8 mb-12 w-full max-w-2xl bg-gray-800 border-gray-700 text-white mx-auto">
                  <CardHeader className="flex flex-col items-center text-center">
                    {userData.avatar_url && (
                      <Image
                        src={userData.avatar_url}
                        alt={`${userData.name || userData.login}'s avatar`}
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

            {/* --- Profile Insights Section --- */}
            {userData && (mostUsedLang || oldestRepo || latestRepo || longestStreak > 0 || distinctLanguages > 0) && (
              <div className="mb-12 w-full max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-center">Profile Insights</h2>
                <Card className="bg-gray-800 border-gray-700 text-white p-4">
                  <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
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

            {/* --- Developer Persona Analysis Section --- */}
            {userData && personaData && (
              <div className="mb-12 w-full max-w-7xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-center">Developer Persona Analysis</h2>
                
                {/* Primary Persona Hero Card */}
                <div className="mb-8">
                  <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-700/50 text-white">
                    <CardContent className="p-8 text-center">
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <span className="text-6xl">
                          {personaData.primaryPersona === "Night Owl Coder" ? "🦉" :
                           personaData.primaryPersona === "Early Bird Developer" ? "🌅" :
                           personaData.primaryPersona === "Weekend Warrior" ? "🏃‍♂️" :
                           personaData.primaryPersona === "9-to-5 Developer" ? "💼" :
                           personaData.primaryPersona === "Bug Hunter" ? "🐛" :
                           personaData.primaryPersona === "Feature Developer" ? "✨" :
                           personaData.primaryPersona === "Code Gardener" ? "🌱" :
                           personaData.primaryPersona === "Documentation Champion" ? "📚" :
                           personaData.primaryPersona === "Open Source Contributor" ? "🌍" :
                           personaData.primaryPersona === "Team Player" ? "👥" :
                           personaData.primaryPersona === "Solo Developer" ? "🦅" : "👨‍💻"}
                        </span>
                        <div>
                          <h3 className="text-3xl font-bold">{personaData.primaryPersona}</h3>
                          <p className="text-gray-300">
                            {personaData.primaryPersona === "Night Owl Coder" ? "You code best when the world sleeps" :
                             personaData.primaryPersona === "Early Bird Developer" ? "You're most productive in the morning" :
                             personaData.primaryPersona === "Weekend Warrior" ? "You code best when the world takes a break" :
                             personaData.primaryPersona === "9-to-5 Developer" ? "You maintain a consistent work schedule" :
                             personaData.primaryPersona === "Bug Hunter" ? "You excel at finding and fixing issues" :
                             personaData.primaryPersona === "Feature Developer" ? "You love building new functionality" :
                             personaData.primaryPersona === "Code Gardener" ? "You keep codebases clean and healthy" :
                             personaData.primaryPersona === "Documentation Champion" ? "You ensure code is well-documented" :
                             personaData.primaryPersona === "Open Source Contributor" ? "You're active in the open source community" :
                             personaData.primaryPersona === "Team Player" ? "You thrive in collaborative environments" :
                             personaData.primaryPersona === "Solo Developer" ? "You prefer working independently" : "You have a unique coding style"}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-center items-center gap-8">
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Confidence</p>
                          <p className="text-2xl font-bold text-green-400">{personaData.confidence.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Peak Time</p>
                          <p className="text-xl font-semibold">
                            {personaData.timeAnalysis?.peakHour === 0 ? "12 AM" :
                             personaData.timeAnalysis?.peakHour === 12 ? "12 PM" :
                             personaData.timeAnalysis?.peakHour > 12 ? `${personaData.timeAnalysis.peakHour - 12} PM` :
                             `${personaData.timeAnalysis?.peakHour} AM`}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Peak Day</p>
                          <p className="text-xl font-semibold">
                            {personaData.timeAnalysis?.peakDay === 0 ? "Sunday" :
                             personaData.timeAnalysis?.peakDay === 1 ? "Monday" :
                             personaData.timeAnalysis?.peakDay === 2 ? "Tuesday" :
                             personaData.timeAnalysis?.peakDay === 3 ? "Wednesday" :
                             personaData.timeAnalysis?.peakDay === 4 ? "Thursday" :
                             personaData.timeAnalysis?.peakDay === 5 ? "Friday" : "Saturday"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Main Analysis Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  
                  {/* Time Analysis Card */}
                  <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">⏰</span>
                        Time Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Hour Distribution Chart */}
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Hourly Activity Pattern</h4>
                        <div className="grid grid-cols-12 gap-1 h-32">
                          {Array.from({ length: 24 }, (_, i) => {
                            const count = personaData.timeAnalysis?.hourDistribution?.[i] || 0;
                            const maxCount = Math.max(...Object.values(personaData.timeAnalysis?.hourDistribution || {}).map(v => Number(v) || 0));
                            const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                              <div
                                key={i}
                                className="bg-gray-700 rounded-sm flex items-end justify-center"
                                style={{
                                  height: `${Math.max(5, height)}%`,
                                  backgroundColor: i === personaData.timeAnalysis?.peakHour ? '#10b981' : '#374151'
                                }}
                              >
                                <span className="text-xs text-gray-400 -rotate-90 transform origin-center">
                                  {i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i-12} PM` : `${i} AM`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Day of Week Distribution */}
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Weekly Activity Pattern</h4>
                        <div className="grid grid-cols-7 gap-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                            const count = personaData.timeAnalysis?.dayOfWeekDistribution?.[i] || 0;
                            const maxCount = Math.max(...Object.values(personaData.timeAnalysis?.dayOfWeekDistribution || {}).map(v => Number(v) || 0));
                            const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                              <div key={day} className="text-center">
                                <div
                                  className="bg-gray-700 rounded-lg p-2 mb-1"
                                  style={{
                                    backgroundColor: i === personaData.timeAnalysis?.peakDay ? '#10b981' : '#374151',
                                    height: `${Math.max(20, height)}px`
                                  }}
                                />
                                <p className="text-xs text-gray-400">{day}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time Persona Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-gray-700 rounded">
                          <p className="text-sm text-gray-400">Time Persona</p>
                          <p className="font-bold text-green-400">{personaData.timeAnalysis?.timePersona}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-700 rounded">
                          <p className="text-sm text-gray-400">Confidence</p>
                          <p className="font-bold">{personaData.timeAnalysis?.timeConfidence.toFixed(1)}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity Analysis Card */}
                  <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        Activity Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Activity Breakdown */}
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Commit Activity Breakdown</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-red-500 rounded"></div>
                              <span>Bug Fixes</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{personaData.activityAnalysis?.bugFixCount}</span>
                              <span className="text-gray-400">
                                ({personaData.activityAnalysis?.totalCommits > 0 ? 
                                  ((personaData.activityAnalysis.bugFixCount / personaData.activityAnalysis.totalCommits) * 100).toFixed(0) : 0}%)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-blue-500 rounded"></div>
                              <span>Features</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{personaData.activityAnalysis?.featureCount}</span>
                              <span className="text-gray-400">
                                ({personaData.activityAnalysis?.totalCommits > 0 ? 
                                  ((personaData.activityAnalysis.featureCount / personaData.activityAnalysis.totalCommits) * 100).toFixed(0) : 0}%)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-500 rounded"></div>
                              <span>Refactors</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{personaData.activityAnalysis?.refactorCount}</span>
                              <span className="text-gray-400">
                                ({personaData.activityAnalysis?.totalCommits > 0 ? 
                                  ((personaData.activityAnalysis.refactorCount / personaData.activityAnalysis.totalCommits) * 100).toFixed(0) : 0}%)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                              <span>Documentation</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{personaData.activityAnalysis?.docsCount}</span>
                              <span className="text-gray-400">
                                ({personaData.activityAnalysis?.totalCommits > 0 ? 
                                  ((personaData.activityAnalysis.docsCount / personaData.activityAnalysis.totalCommits) * 100).toFixed(0) : 0}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Activity Persona */}
                      <div className="text-center p-4 bg-gray-700 rounded">
                        <h4 className="text-lg font-semibold mb-2">{personaData.activityAnalysis?.activityPersona}</h4>
                        <p className="text-sm text-gray-400 mb-2">
                          {personaData.activityAnalysis?.activityPersona === "Bug Hunter" ? "You excel at finding and fixing issues" :
                           personaData.activityAnalysis?.activityPersona === "Feature Developer" ? "You love building new functionality" :
                           personaData.activityAnalysis?.activityPersona === "Code Gardener" ? "You keep codebases clean and healthy" :
                           personaData.activityAnalysis?.activityPersona === "Documentation Champion" ? "You ensure code is well-documented" :
                           "You maintain a balanced development approach"}
                        </p>
                        <div className="flex justify-center items-center gap-4">
                          <div>
                            <p className="text-sm text-gray-400">Confidence</p>
                            <p className="font-bold text-blue-400">{personaData.activityAnalysis?.activityConfidence.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Total Commits</p>
                            <p className="font-bold">{personaData.activityAnalysis?.totalCommits}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Collaboration Analysis Card */}
                  <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">👥</span>
                        Collaboration Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Collaboration Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-gray-700 rounded">
                          <p className="text-sm text-gray-400">Repositories</p>
                          <p className="font-bold text-xl">{personaData.collaborationAnalysis?.reposContributedTo}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-700 rounded">
                          <p className="text-sm text-gray-400">PR Reviews</p>
                          <p className="font-bold text-xl">{personaData.collaborationAnalysis?.prReviews}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-700 rounded">
                          <p className="text-sm text-gray-400">Comments</p>
                          <p className="font-bold text-xl">{personaData.collaborationAnalysis?.prComments}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-700 rounded">
                          <p className="text-sm text-gray-400">Issues</p>
                          <p className="font-bold text-xl">{personaData.collaborationAnalysis?.issuesCreated + personaData.collaborationAnalysis?.issuesClosed}</p>
                        </div>
                      </div>

                      {/* Collaboration Persona */}
                      <div className="text-center p-4 bg-gray-700 rounded">
                        <h4 className="text-lg font-semibold mb-2">{personaData.collaborationAnalysis?.collaborationPersona}</h4>
                        <p className="text-sm text-gray-400 mb-2">
                          {personaData.collaborationAnalysis?.collaborationPersona === "Open Source Contributor" ? "You're active in the open source community" :
                           personaData.collaborationAnalysis?.collaborationPersona === "Team Player" ? "You thrive in collaborative environments" :
                           personaData.collaborationAnalysis?.collaborationPersona === "Solo Developer" ? "You prefer working independently" :
                           "You maintain a collaborative development approach"}
                        </p>
                        <div className="flex justify-center">
                          <div>
                            <p className="text-sm text-gray-400">Confidence</p>
                            <p className="font-bold text-purple-400">{personaData.collaborationAnalysis?.collaborationConfidence.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Persona Insights Card */}
                  <Card className="bg-gray-800 border-gray-700 text-white">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">🎭</span>
                        Persona Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-700/30">
                        <h4 className="font-semibold mb-2">
                          {personaData.timeAnalysis?.timePersona} + {personaData.collaborationAnalysis?.collaborationPersona}
                        </h4>
                        <p className="text-sm text-gray-300">
                          {personaData.timeAnalysis?.timePersona === "Weekend Warrior" && personaData.collaborationAnalysis?.collaborationPersona === "Solo Developer" 
                            ? "You're a passionate weekend coder who prefers working independently on personal projects. Your coding sessions peak on weekends, showing a clear preference for leisure-time programming."
                            : "You have a unique combination of time management and collaboration styles that defines your development approach."}
                        </p>
                      </div>
                      
                      {personaData.activityAnalysis?.bugFixCount > personaData.activityAnalysis?.featureCount && (
                        <div className="p-4 bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg border border-red-700/30">
                          <h4 className="font-semibold mb-2">🐛 Bug Hunter Tendencies</h4>
                          <p className="text-sm text-gray-300">
                            {personaData.activityAnalysis?.bugFixCount} of your {personaData.activityAnalysis?.totalCommits} commits are bug fixes - you're excellent at problem-solving and maintaining code quality!
                          </p>
                        </div>
                      )}

                      {personaData.activityAnalysis?.featureCount > personaData.activityAnalysis?.bugFixCount && (
                        <div className="p-4 bg-gradient-to-r from-green-900/30 to-teal-900/30 rounded-lg border border-green-700/30">
                          <h4 className="font-semibold mb-2">✨ Feature Builder</h4>
                          <p className="text-sm text-gray-300">
                            You focus on building new functionality with {personaData.activityAnalysis?.featureCount} feature commits, showing a strong drive for innovation and growth.
                          </p>
                        </div>
                      )}

                      {personaData.collaborationAnalysis?.reposContributedTo > 10 && (
                        <div className="p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg border border-blue-700/30">
                          <h4 className="font-semibold mb-2">🌍 Open Source Enthusiast</h4>
                          <p className="text-sm text-gray-300">
                            Contributing to {personaData.collaborationAnalysis?.reposContributedTo} repositories shows your commitment to the open source community!
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Confidence Indicators */}
                <Card className="bg-gray-800 border-gray-700 text-white mb-8">
                  <CardHeader>
                    <CardTitle>Analysis Confidence</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Time Analysis</span>
                        <span className="font-semibold">{personaData.timeAnalysis?.timeConfidence.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${personaData.timeAnalysis?.timeConfidence || 0}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Activity Analysis</span>
                        <span className="font-semibold">{personaData.activityAnalysis?.activityConfidence.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${personaData.activityAnalysis?.activityConfidence || 0}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Collaboration Analysis</span>
                        <span className="font-semibold">{personaData.collaborationAnalysis?.collaborationConfidence.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${personaData.collaborationAnalysis?.collaborationConfidence || 0}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-semibold">Overall Confidence</span>
                        <span className="font-bold text-yellow-400">{personaData.confidence.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${personaData.confidence || 0}%` }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Statistics Summary */}
                <Card className="bg-gray-800 border-gray-700 text-white">
                  <CardHeader>
                    <CardTitle>Key Statistics Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gray-700 rounded">
                        <p className="text-2xl font-bold text-green-400">{personaData.activityAnalysis?.totalCommits}</p>
                        <p className="text-sm text-gray-400">Total Commits</p>
                      </div>
                      <div className="text-center p-4 bg-gray-700 rounded">
                        <p className="text-2xl font-bold text-blue-400">
                          {personaData.timeAnalysis?.peakHour === 0 ? "12 AM" :
                           personaData.timeAnalysis?.peakHour === 12 ? "12 PM" :
                           personaData.timeAnalysis?.peakHour > 12 ? `${personaData.timeAnalysis.peakHour - 12} PM` :
                           `${personaData.timeAnalysis?.peakHour} AM`}
                        </p>
                        <p className="text-sm text-gray-400">Peak Hour</p>
                      </div>
                      <div className="text-center p-4 bg-gray-700 rounded">
                        <p className="text-2xl font-bold text-purple-400">
                          {personaData.timeAnalysis?.peakDay === 0 ? "Sunday" :
                           personaData.timeAnalysis?.peakDay === 1 ? "Monday" :
                           personaData.timeAnalysis?.peakDay === 2 ? "Tuesday" :
                           personaData.timeAnalysis?.peakDay === 3 ? "Wednesday" :
                           personaData.timeAnalysis?.peakDay === 4 ? "Thursday" :
                           personaData.timeAnalysis?.peakDay === 5 ? "Friday" : "Saturday"}
                        </p>
                        <p className="text-sm text-gray-400">Peak Day</p>
                      </div>
                      <div className="text-center p-4 bg-gray-700 rounded">
                        <p className="text-2xl font-bold text-yellow-400">{personaData.collaborationAnalysis?.reposContributedTo}</p>
                        <p className="text-sm text-gray-400">Repositories</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* --- Contribution Heatmap Section (Only when logged in) --- */}
            {loggedInUser && contributionData && heatmapValues.length > 0 && (
                 <div className="mb-12 w-full max-w-6xl mx-auto">
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

            {/* --- Monthly Contributions Chart (Only when logged in) --- */}
            {loggedInUser && monthlyContributionData.length > 0 && (
                <div className="mb-12 w-full max-w-6xl mx-auto">
                    <h2 className="text-2xl font-semibold mb-4 text-center">Monthly Contributions</h2>
                    <Card className="bg-gray-800 border-gray-700 text-white">
                        <CardContent className="p-4 pl-2 pr-6 pt-4">
                            <ChartContainer config={monthlyContributionConfig} className="w-full h-[300px]">
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

            {/* --- Main Charts Grid --- */}
            {userData && (
              <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-7xl mx-auto">
                {/* Language Usage Pie Chart */}
                {languageChartData.length > 0 && (
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold mb-4 text-center">Language Usage</h2>
                    <Card className="bg-gray-800 border-gray-700 text-white p-4 flex flex-col items-center">
                      <CardContent className="w-full p-0 mt-4">
                        <div className="flex flex-row w-full h-[300px] aspect-square mx-auto">
                          {/* Legend: left half (hide on small screens) */}
                          {!isSmallScreen && (
                            <div
                              className="w-1/2 h-full flex items-center justify-center md:w-1/2 w-full md:static absolute top-0 left-0 z-10"
                            >
                              <div
                                className="chart-legend-scroll p-2 bg-transparent rounded-md w-full max-w-xs"
                              >
                                {languageChartData.map((entry) => (
                                  <div
                                    key={entry.language}
                                    className="flex items-start gap-2 px-1 py-0.5 rounded transition-colors hover:bg-gray-700/40 cursor-pointer"
                                    data-tooltip-id="legend-tooltip"
                                    data-tooltip-content={entry.language}
                                  >
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        background: entry.fill,
                                        border: '2px solid #222',
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      className="text-gray-200 text-base font-medium whitespace-nowrap"
                                      style={{ lineHeight: '1.2' }}
                                    >
                                      {entry.language}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <ReactTooltip
                                id="legend-tooltip"
                                place="top"
                              />
                            </div>
                          )}
                          {/* Chart: right half or full width on small screens */}
                          <div className={`${isSmallScreen ? "w-full" : "w-1/2"} h-full flex items-center justify-center`}>
                            <ChartContainer config={languageChartConfig} className="w-full h-full">
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {/* Top Repositories by Stars */}
                {repoChartData.length > 0 && (
                  <div className="w-full">
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
                                            tick={renderRepoNameTick}
                                            tickMargin={8}
                                            width={120}
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
                {/* Top Repositories by Forks */}
                {topForksChartData.length > 0 && (
                  <div className="w-full">
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
                                            tick={renderRepoNameTick}
                                            tickMargin={8}
                                            width={120}
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
                {/* Event Type Breakdown Pie Chart */}
                {eventTypeChartData.length > 0 && (
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold mb-1 text-center">Event Type Breakdown</h2>
                      <p className="text-sm text-muted-foreground text-center mb-3">(Based on recent events, approx. last 90 days)</p>
                      <Card className="bg-gray-800 border-gray-700 text-white p-4 flex flex-col items-center">
                        <CardContent className="w-full p-0 mt-4">
                          <div className="flex flex-row w-full h-[300px] aspect-square mx-auto">
                            {/* Legend: left half (hide on small screens) */}
                            {!isSmallScreen && (
                              <div className="w-1/2 h-full flex items-center justify-center md:w-1/2 w-full md:static absolute top-0 left-0 z-10">
                                <div className="chart-legend-scroll p-2 bg-transparent rounded-md w-full max-w-xs">
                                  {eventTypeChartData.map((entry) => (
                                    <div
                                      key={entry.type}
                                      className="flex items-start gap-2 px-1 py-0.5 rounded transition-colors hover:bg-gray-700/40 cursor-pointer"
                                      data-tooltip-id="event-legend-tooltip"
                                      data-tooltip-content={entry.type}
                                    >
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          width: 18,
                                          height: 18,
                                          borderRadius: 4,
                                          background: entry.fill,
                                          border: '2px solid #222',
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        className="text-gray-200 text-base font-medium whitespace-nowrap"
                                        style={{ lineHeight: '1.2' }}
                                      >
                                        {entry.type}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <ReactTooltip
                                  id="event-legend-tooltip"
                                  place="top"
                                />
                              </div>
                            )}
                            {/* Chart: right half or full width on small screens */}
                            <div className={`${isSmallScreen ? "w-full" : "w-1/2"} h-full flex items-center justify-center`}>
                              <ChartContainer config={eventTypeChartConfig} className="w-full h-full">
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
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                  </div>
                )}
                {/* Most Active Repositories Bar Chart */}
                {activeRepoChartData.length > 0 && (
                  <div className="w-full">
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
                                              tick={renderRepoNameTick}
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
                {/* Contributions per Weekday */}
                {loggedInUser && weekdayContributionChartData.some(d => d.contributions > 0) && (
                  <div className="w-full">
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
                                <Bar dataKey="contributions" radius={4} fill="hsl(var(--chart-2))">
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
                {/* Repository Age Distribution */}
                {repoAgeChartData.length > 0 && (
                  <div className="w-full">
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
                                <Bar dataKey="count" radius={6} fill="var(--color-repo-age)">
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
                {/* Daily Contribution Intensity */}
                {loggedInUser && dailyIntensityData.length > 0 && (
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold mb-1 text-center">Daily Contribution Intensity</h2>
                    <p className="text-sm text-muted-foreground text-center mb-3">(Last Year)</p>
                    <Card className="bg-gray-800 border-gray-700 text-white">
                      <CardContent className="p-4 pl-2 pr-6 pt-4">
                        <ChartContainer config={dailyIntensityConfig} className="w-full h-[300px]">
                           <BarChart
                              accessibilityLayer
                              data={dailyIntensityData}
                              layout="vertical"
                              margin={{ right: 16 }} // Add right margin for labels
                           >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                              dataKey="range"
                              type="category"
                              tickLine={false}
                              tickMargin={10}
                              axisLine={false}
                              hide // Hide the axis itself
                            />
                            <XAxis dataKey="count" type="number" hide />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent 
                                          className="bg-popover text-popover-foreground border rounded-md shadow-md p-2"
                                          indicator="line" 
                                          formatter={(value, name) => {
                                            if (name === 'count') return `${value} days`;
                                            return value;
                                          }}
                                          labelFormatter={(label) => `Range: ${label} contributions/day`}
                                      />}
                            />
                            <Bar
                              dataKey="count"
                              layout="vertical"
                              fill="var(--color-count)" // Use color from config
                              radius={4}
                            >
                              <LabelList
                                dataKey="range" // Show the range label inside
                                position="insideLeft"
                                offset={8}
                                className="fill-white"
                                fontSize={12}
                              />
                              <LabelList
                                dataKey="count" // Show the count label outside
                                position="right"
                                offset={8}
                                className="fill-white"
                                fontSize={12}
                                formatter={(value: number) => value > 0 ? value : ''} // Hide 0 labels
                              />
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* --- Recent Activity Section --- */}
            {events.length > 0 && (
                 <div className="mb-12 w-full max-w-4xl mx-auto">
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

            {/* --- Repositories List Section --- */}
            {repos.length > 0 && (
              <div className="mt-12 w-full max-w-7xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-center">Repositories ({repos.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {repos.map((repo) => {
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
          </>
        )}
      </div> {/* End max-w-7xl container */}
    </main>
  );
}
  