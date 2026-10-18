import { Component, type ReactNode } from 'react';

/** Optional artwork must never take down navigation. Also used outside Canvas for WebGL errors. */
export class ExploreBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
