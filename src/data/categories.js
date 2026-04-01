import { FiCode, FiCpu, FiZap, FiEdit3 } from 'react-icons/fi';
import React from 'react';

export const categories = [
  { id: 1, name: 'Programming & Development', icon: React.createElement(FiCode), count: 0, color: '#008ad1' },
  { id: 2, name: 'Artificial Intelligence & Automation', icon: React.createElement(FiCpu), count: 0, color: '#6366f1' },
  { id: 3, name: 'AI Productivity & Prompting', icon: React.createElement(FiZap), count: 0, color: '#8b5cf6' },
  { id: 4, name: 'Design & Creativity', icon: React.createElement(FiEdit3), count: 0, color: '#f59e0b' },
];

// Maps old/legacy category names to the new standardized names
const categoryMapping = {
  'Web Development': 'AI Productivity & Prompting',
  'Data Science': 'AI Productivity & Prompting',
  'AI & Machine Learning': 'AI Productivity & Prompting',
  'Business & Management': 'AI Productivity & Prompting',
  'Business': 'AI Productivity & Prompting',
  'Design': 'AI Productivity & Prompting',
  'Marketing': 'AI Productivity & Prompting',
  'Photography': 'AI Productivity & Prompting',
  // New categories map to themselves
  'Programming & Development': 'Programming & Development',
  'Artificial Intelligence & Automation': 'Artificial Intelligence & Automation',
  'AI Productivity & Prompting': 'AI Productivity & Prompting',
  'Design & Creativity': 'Design & Creativity',
};

export function mapCategory(oldCategory) {
  return categoryMapping[oldCategory] || 'AI Productivity & Prompting';
}
