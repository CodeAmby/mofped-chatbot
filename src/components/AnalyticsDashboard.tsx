"use client";

import { useState, useEffect } from 'react';
import { analyticsService } from '@/lib/analytics';

interface AnalyticsData {
  totalQueries: number;
  averageResponseTime: number;
  popularQueries: Array<{ query: string; count: number }>;
  optionClicks: Array<{ option: string; count: number }>;
  externalLinkClicks: Array<{ link: string; count: number }>;
  documentsFound: Array<{ count: number; frequency: number }>;
  sessionData: Array<{ query: string; responseTime: number; documentsFound: number; timestamp: string; sessionId: string }>;
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = () => {
    const sessionData = analyticsService.getSessionData();
    
    // Process session data
    const totalQueries = sessionData.length;
    const averageResponseTime = sessionData.length > 0 
      ? sessionData.reduce((sum, item) => sum + item.responseTime, 0) / sessionData.length 
      : 0;

    // Popular queries
    const queryCounts: Record<string, number> = {};
    sessionData.forEach(item => {
      queryCounts[item.query] = (queryCounts[item.query] || 0) + 1;
    });
    const popularQueries = Object.entries(queryCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Documents found distribution
    const docCounts: Record<number, number> = {};
    sessionData.forEach(item => {
      docCounts[item.documentsFound] = (docCounts[item.documentsFound] || 0) + 1;
    });
    const documentsFound = Object.entries(docCounts)
      .map(([count, frequency]) => ({ count: parseInt(count), frequency }))
      .sort((a, b) => a.count - b.count);

    setAnalytics({
      totalQueries,
      averageResponseTime,
      popularQueries,
      optionClicks: [], // Would be populated from server-side analytics
      externalLinkClicks: [], // Would be populated from server-side analytics
      documentsFound,
      sessionData
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return <div className="p-8 text-gray-500">No analytics data available</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8" style={{ color: '#103B73' }}>
        MoFPED Chatbot Analytics
      </h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Queries</h3>
          <p className="text-3xl font-bold" style={{ color: '#103B73' }}>
            {analytics.totalQueries}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Avg Response Time</h3>
          <p className="text-3xl font-bold" style={{ color: '#2E7D32' }}>
            {Math.round(analytics.averageResponseTime)}ms
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Active Sessions</h3>
          <p className="text-3xl font-bold" style={{ color: '#103B73' }}>
            {new Set(analytics.sessionData.map(s => s.sessionId)).size}
          </p>
        </div>
      </div>

      {/* Popular Queries */}
      <div className="bg-white p-6 rounded-lg shadow-md border mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#103B73' }}>
          Most Popular Queries
        </h2>
        <div className="space-y-3">
          {analytics.popularQueries.map((item, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium text-gray-700">{item.query}</span>
              <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                {item.count} times
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Documents Found Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-md border mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#103B73' }}>
          Documents Found Distribution
        </h2>
        <div className="space-y-3">
          {analytics.documentsFound.map((item, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium text-gray-700">
                {item.count} document{item.count !== 1 ? 's' : ''} found
              </span>
              <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                {item.frequency} times
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#103B73' }}>
          Recent Activity
        </h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {analytics.sessionData.slice(-10).reverse().map((item, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded border-l-4" style={{ borderLeftColor: '#103B73' }}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-700">{item.query}</p>
                  <p className="text-sm text-gray-500">
                    {item.documentsFound} documents found • {item.responseTime}ms
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Data */}
      <div className="mt-8 text-center">
        <button
          onClick={() => {
            const dataStr = JSON.stringify(analytics.sessionData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mofped-chat-analytics-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Export Analytics Data
        </button>
      </div>
    </div>
  );
}
