import { useEffect, useState, Suspense, lazy } from 'react';

// Dynamically import the Editor component to avoid SSR issues with CodeMirror
const Editor = lazy(() => import('./Editor.jsx'));

// Loading component for the editor
const EditorLoading = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: '#282a36',
    color: '#f8f8f2',
    fontFamily: 'monospace',
    fontSize: '14px'
  }}>
    <div style={{
      textAlign: 'center',
      padding: '20px'
    }}>
      <div style={{
        marginBottom: '10px',
        fontSize: '16px'
      }}>
        Loading Editor...
      </div>
      <div style={{
        width: '40px',
        height: '4px',
        background: '#44475a',
        borderRadius: '2px',
        overflow: 'hidden',
        margin: '0 auto'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, #ff79c6, #bd93f9, #50fa7b)',
          animation: 'loading 1.5s infinite ease-in-out',
          borderRadius: '2px'
        }} />
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  </div>
);

const EditorWrapper = (props) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Only render the editor on the client side
    setIsClient(true);
  }, []);

  // Don't render anything during SSR
  if (!isClient) {
    return <EditorLoading />;
  }

  return (
    <Suspense fallback={<EditorLoading />}>
      <Editor {...props} />
    </Suspense>
  );
};

export default EditorWrapper;