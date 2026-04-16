import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { BrowserRouter } from 'react-router-dom'
import { ApolloProvider, ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'

const httpLink = createHttpLink({
    uri: '/api/graphql',
});

const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ApolloProvider client={client}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
            </BrowserRouter>
        </ApolloProvider>
    </React.StrictMode>,
)
