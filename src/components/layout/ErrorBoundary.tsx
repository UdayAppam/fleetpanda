import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.fallback}>
          <h3>Something broke in {this.props.fallbackLabel ?? 'this view'}</h3>
          <p className={styles.message}>{this.state.error.message}</p>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
