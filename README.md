# tailwind-material-design-code-mod

This is an example how to use jscodeshift to change the Tailwind
class names in a React code base. It was a very specific problem 
I had solved in early 2024 as part of a large refactor to an existing 
project. See this blog post for more details.

The following scripts are available:

Generate two JSON files that map the old Tailwind color values to 
their newer counterparts:

```
npm run map-configs
```

Generate a JSON and text file to analyze the usage of the `className` 
JSX attribute in a code base.

```
npm run analyze-class-names
```
