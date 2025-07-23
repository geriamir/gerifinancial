// Mock for react-dom/test-utils to support React 19
const { act } = require('react');

module.exports = {
  act,
  // Add other commonly used test-utils functions if needed
  Simulate: {},
  renderIntoDocument: () => {},
  isElement: () => true,
  isElementOfType: () => true,
  isDOMComponent: () => true,
  isCompositeComponent: () => true,
  isCompositeComponentWithType: () => true,
  findAllInRenderedTree: () => [],
  scryRenderedDOMComponentsWithClass: () => [],
  findRenderedDOMComponentWithClass: () => ({}),
  scryRenderedDOMComponentsWithTag: () => [],
  findRenderedDOMComponentWithTag: () => ({}),
  scryRenderedComponentsWithType: () => [],
  findRenderedComponentWithType: () => ({}),
  mockComponent: () => {},
};
