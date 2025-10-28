import React, { useState } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { contractService } from '../lib/contracts';
import { useAppStore } from '../lib/store';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated
}) => {
  const [question, setQuestion] = useState('');
  const [duration, setDuration] = useState('24'); // hours
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, isAuthenticated } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !user) {
      setError('Please connect your wallet first');
      return;
    }

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (!duration || parseInt(duration) <= 0) {
      setError('Please enter a valid duration');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const durationInSeconds = parseInt(duration) * 60 * 60; // Convert hours to seconds
      const txHash = await contractService.createEvent(question.trim(), durationInSeconds);
      
      alert('Event created successfully!');
      
      // Reset form
      setQuestion('');
      setDuration('24');
      
      // Notify parent component
      if (onEventCreated) {
        onEventCreated();
      }
      
      onClose();
    } catch (error: any) {
      console.error('Error creating event:', error);
      setError(error.message || 'Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Create New Event</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
              Event Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will Bitcoin reach $100,000 by the end of 2024?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              required
            />
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration (hours)
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                max="8760" // 1 year
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Event will be open for betting for this duration
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-start">
              <AlertCircle className="text-yellow-600 mr-2 mt-0.5" size={16} />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Important:</p>
                <p>Only contract owners can create events. Make sure you have the necessary permissions.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-start">
                <AlertCircle className="text-red-600 mr-2 mt-0.5" size={16} />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Error:</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};