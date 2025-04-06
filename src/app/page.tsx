'use client';

import { useState } from 'react';
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
  stargazersCount: number;
  forksCount: number;
}

// Interface for Language Stats
type LanguageStats = Record<string, number>; // Simple map { languageName: count }

export default function Home() {
  const [username, setUsername] = useState<string>('');
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]); // State for repositories
  const [languageStats, setLanguageStats] = useState<LanguageStats | null>(null); // State for language stats
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!username) {
      setError('Please enter a GitHub username.');
      return;
    }
    setLoading(true);
    setError(null);
    setUserData(null);
    setRepos([]); // Clear previous repos
    setLanguageStats(null); // Clear previous stats

    try {
      // Fetch user data
      const userResponse = await fetch(`http://localhost:8080/api/users/${username}`);
      if (!userResponse.ok) {
        const errorData = await userResponse.text();
        throw new Error(`User fetch error: ${errorData || userResponse.statusText}`);
      }
      const userDataJson: GitHubUser = await userResponse.json();
      setUserData(userDataJson);

      // Fetch repository data
      const repoResponse = await fetch(`http://localhost:8080/api/users/${username}/repos`);

      // Log the raw JSON text response for repos
      const repoJsonText = await repoResponse.text();
      console.log("Raw Repo JSON Text:", repoJsonText);

      // Now parse the logged text
      if (repoResponse.ok) {
        try {
            const repoDataJson: GitHubRepo[] = JSON.parse(repoJsonText);
            setRepos(repoDataJson);
        } catch (parseError) {
            console.error("Failed to parse repo JSON:", parseError);
            setError("Failed to parse repository data from backend.");
            setRepos([]);
        }
      } else {
        console.warn(`Repo fetch warning: Status ${repoResponse.status}, Body: ${repoJsonText}`);
        setError(`Failed to fetch repositories (Status: ${repoResponse.status})`);
        setRepos([]);
      }

      // --- Fetch Language Stats --- 
      const langResponse = await fetch(`http://localhost:8080/api/users/${username}/languages`);
      if (!langResponse.ok) {
          console.warn(`Language fetch warning: Status ${langResponse.status}`);
          setLanguageStats({}); // Set empty stats on failure
      } else {
          const langDataJson: LanguageStats = await langResponse.json();
          setLanguageStats(langDataJson);
      }
      // --- End Fetch Language Stats --- 

    } catch (err: any) {
      setError(err.message || 'Failed to fetch data.');
      console.error(err);
      setUserData(null); // Ensure user data is cleared on error
      setRepos([]);      // Ensure repo data is cleared on error
      setLanguageStats(null); // Clear stats on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start w-full px-4">
        <div className="flex gap-2 mb-6 w-full max-w-md">
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter GitHub username (e.g., octocat)"
            className="flex-grow p-3 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch Stats'}
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

        {/* --- Language Stats Section --- */}
        {languageStats && Object.keys(languageStats).length > 0 && (
            <div className="mt-8 w-full max-w-4xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Language Usage</h2>
                 <Card className="bg-gray-800 border-gray-700 text-white p-4">
                     <CardContent className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
                        {Object.entries(languageStats)
                           // Optional: Sort languages by count descending
                           .sort(([, countA], [, countB]) => countB - countA)
                           .map(([language, count]) => (
                            <div key={language} className="text-center px-3 py-1 bg-gray-700 rounded">
                                <p className="font-semibold">{language}</p>
                                <p className="text-sm text-gray-400">({count} repo{count > 1 ? 's' : ''})</p>
                            </div>
                        ))}
                     </CardContent>
                 </Card>
            </div>
        )}
        {/* --- End Language Stats Section --- */}

        {repos.length > 0 && (
          <div className="mt-8 w-full max-w-4xl">
            <h2 className="text-2xl font-semibold mb-4 text-center">Repositories ({repos.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {repos.map((repo) => {
                // Log the entire repo object
                console.log('Processing repo object:', repo);
                // Previous log for specific fields (can be removed if the object log works)
                // console.log(`Repo: ${repo.name}, Stars: ${repo.stargazersCount}, Forks: ${repo.forksCount}`);

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
                      <p>Stars: <span className="font-semibold text-gray-300">{repo.stargazersCount}</span></p>
                      <p>Forks: <span className="font-semibold text-gray-300">{repo.forksCount}</span></p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
