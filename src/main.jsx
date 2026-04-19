import { render } from 'preact';
import { App } from './App';
import './styles/index.css';
import './styles/empty-state.css';
import './styles/toasts.css';

render(<App />, document.getElementById('app'));
