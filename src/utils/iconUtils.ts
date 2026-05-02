
import React from 'react';
import { Eye, Database, Pencil, Star, User, Lightbulb } from "lucide-react";
import { LucideIcon } from 'lucide-react';

// Define return type as a React functional component
export const getIconComponent = (iconName: string): React.ReactNode => {
  switch (iconName) {
    case "fa-book-open":
      return React.createElement(Eye, { className: "h-5 w-5" });
    case "fa-link":
      return React.createElement(Database, { className: "h-5 w-5" });
    case "fa-pencil-alt":
      return React.createElement(Pencil, { className: "h-5 w-5" });
    case "fa-check-square":
      return React.createElement(Star, { className: "h-5 w-5" });
    case "fa-comments":
      return React.createElement(User, { className: "h-5 w-5" });
    case "fa-question-circle":
      return React.createElement(Lightbulb, { className: "h-5 w-5" });
    default:
      return React.createElement(Eye, { className: "h-5 w-5" });
  }
};
