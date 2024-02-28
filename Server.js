// Import necessary modules and libraries
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { addMonths } = require('date-fns');

// Define a function to initialize the API
function initializeDepreciationAPI() {
    // Create an Express application
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Parse incoming request bodies in a middleware before your handlers
    app.use(bodyParser.json());

    // Connect to MongoDB database
    mongoose.connect('mongodb://localhost:27017/depreciationDB', { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('Error connecting to MongoDB:', err));

    // Function to calculate depreciation
    function calculateDepreciation(cost, depreciationRate, months, purchaseDate) {
        // Validate purchaseDate
        if (!purchaseDate || isNaN(new Date(purchaseDate))) {
            throw new Error('Invalid purchaseDate');
        }
    
        const monthlyDepreciation = depreciationRate ? (cost * depreciationRate) / 12 : cost / months;
        const depreciationSchedule = [];
        let currentCost = cost;
        let currentDate = new Date(purchaseDate);
        let month = 0;
        let startYear, endYear;
    
        while (currentCost => monthlyDepreciation ) {
            month++;
    
            // Determine start and end years based on the current month
            if (currentDate.getMonth() >= 3) { // April (0-indexed)
                startYear = currentDate.getFullYear();
                endYear = startYear + 1;
            } else {
                startYear = currentDate.getFullYear() - 1;
                endYear = currentDate.getFullYear();
            }
    
            const financialYear = `${startYear}-${endYear}`;
            const depreciation = Math.min(currentCost, monthlyDepreciation);
            // Round depreciation value to two decimal places
            const roundedDepreciation = parseFloat(depreciation.toFixed(2));
            depreciationSchedule.push({
                month,
                financialYear,
                depreciation: roundedDepreciation
            });
            currentCost -= depreciation;
    
            currentDate = addMonths(currentDate, 1);
    
            // Check if the last month's depreciation is less than or equal to 0
            if (currentCost <= monthlyDepreciation) {
                // Save data to the database or perform other required actions
                return { depreciationSchedule, months: month };
            }
        }
    }
    

    // Define a schema for depreciation records
    const depreciationSchema = new mongoose.Schema({
        companyId: { type: String, required: true },
        assetId: { type: String, required: true },
        cost: { type: Number, required: true },
        depreciationRate: { type: Number },
        months: { type: Number },
        purchaseDate: { type: Date, required: true },
        depreciationSchedule: [{ month: Number, financialYear: String, depreciation: Number }],
        monthsCalculated: Number
    });

    // Create a model based on the schema
    const Depreciation = mongoose.model('depreciationDB', depreciationSchema);

    // POST API endpoint to calculate depreciation and save it to the database
    app.post('/api/depreciation', async (req, res) => {
        try {
            const { companyId, assetId, cost, depreciationRate, months, purchaseDate } = req.body;

            // Validation: Check if depreciationRate, cost, or months is negative
            if (depreciationRate < 0 || cost < 0 || months < 0) {
                return res.status(400).json({ message: 'Negative values are not allowed for depreciationRate, cost, or months.' });
            }

            if ((depreciationRate && months) || (!depreciationRate && !months)) {
                return res.status(400).json({ message: 'Provide either depreciationRate or months, not both.' });
            }

            const { depreciationSchedule, months: monthsCalculated } = calculateDepreciation(cost, depreciationRate, months, purchaseDate);

            // Save depreciation record to the database
            const newDepreciation = new Depreciation({
                companyId,
                assetId,
                cost,
                depreciationRate,
                months,
                purchaseDate,
                depreciationSchedule,
                monthsCalculated
            });
            await newDepreciation.save();

            res.status(200).json({ message: 'Depreciation calculated and saved successfully', depreciation: newDepreciation });
        } catch (error) {
            console.error('Error calculating and saving depreciation:', error);
            res.status(500).json({ message: error.message || 'Internal server error' });
        }
    });

    // GET API endpoint to retrieve all calculated depreciation records from the database
    // GET API endpoint to retrieve depreciation records based on company ID
    app.get('/api/depreciation', async (req, res) => {
        try {
            const { companyId } = req.query;
            let query = {};

            // If companyId is provided in query parameters, filter by companyId
            if (companyId) {
                query = { companyId };
            }

            const depreciationRecords = await Depreciation.find(query);
            res.status(200).json(depreciationRecords);
        } catch (error) {
            console.error('Error fetching depreciation records:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });

    // DELETE API endpoint to delete depreciation records by company ID
    app.delete('/api/depreciation', async (req, res) => {
        try {
            const { companyId } = req.query;
            if (!companyId) {
                return res.status(400).json({ message: 'Company ID is required' });
            }
            const deletedDepreciation = await Depreciation.deleteMany({ companyId });
            if (deletedDepreciation.deletedCount === 0) {
                return res.status(404).json({ message: 'No depreciation records found for the provided company ID' });
            }
            res.status(200).json({ message: 'Depreciation records deleted successfully', count: deletedDepreciation.deletedCount });
        } catch (error) {
            console.error('Error deleting depreciation records:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Call the function to initialize the API
initializeDepreciationAPI();
