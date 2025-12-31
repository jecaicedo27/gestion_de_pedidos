import React from 'react';
import ExpensesManager from '../components/expenses/ExpensesManager';
import { Container } from 'reactstrap';

const ExpensesPage = () => {
    return (
        <>
            <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
                <Container fluid>
                    <div className="header-body">
                        {/* Header content if needed */}
                    </div>
                </Container>
            </div>
            {/* Page content */}
            <Container className="mt--7" fluid>
                <ExpensesManager />
            </Container>
        </>
    );
};

export default ExpensesPage;
