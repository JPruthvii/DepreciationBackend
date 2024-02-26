// Import necessary modules and libraries
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { format, addMonths } = require('date-fns');

// Create an Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming request bodies in a middleware before your handlers
app.use(bodyParser.json());

// Connect to MongoDB database
mongoose.connect('mongodb://localhost:27017/depreciationDB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define the depreciation calculation function
function calculateDepreciation(cost, depreciationRate) {
    const monthlyDepreciation = (cost * depreciationRate) / 12;
    const depreciationSchedule = [];
    let currentCost = cost;
    let currentDate = new Date();
    let month = 0;
    
    while (currentCost > 0) {
        month++;
        currentDate = addMonths(currentDate, 1);
        const financialYear = Math.ceil(month / 12);
        const depreciation = Math.min(currentCost, monthlyDepreciation);
        depreciationSchedule.push({ 
            month,
            financialYear,
            depreciation
        });
        currentCost -= depreciation;
    }
    
    return { depreciationSchedule, months: month };
}

// Define a schema for depreciation records
const depreciationSchema = new mongoose.Schema({
    companyId: { type: String, required: true },
    assetId: { type: String, required: true },
    cost: { type: Number, required: true },
    depreciationRate: { type: Number, required: true },
    depreciationSchedule: [{ month: Number, financialYear: Number, depreciation: Number }],
    months: Number
});

// Create a model based on the schema
const Depreciation = mongoose.model('Depreciation', depreciationSchema);

// POST API endpoint to calculate depreciation and save it to the database
app.post('/api/depreciation', async (req, res) => {
    try {
        const { companyId, assetId, cost, depreciationRate } = req.body;
        const { depreciationSchedule, months } = calculateDepreciation(cost, depreciationRate);
        
        // Save depreciation record to the database
        const newDepreciation = new Depreciation({
            companyId,
            assetId,
            cost,
            depreciationRate,
            depreciationSchedule,
            months
        });
        await newDepreciation.save();
        
        res.status(200).json({ message: 'Depreciation calculated and saved successfully', depreciation: newDepreciation });
    } catch (error) {
        console.error('Error calculating and saving depreciation:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET API endpoint to retrieve all calculated depreciation records from the database
app.get('/api/depreciation', async (req, res) => {
    try {
        const depreciationRecords = await Depreciation.find();
        res.status(200).json(depreciationRecords);
    } catch (error) {
        console.error('Error fetching depreciation records:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// DELETE API endpoint to delete a depreciation record by its ID
app.delete('/api/depreciation/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedDepreciation = await Depreciation.findByIdAndDelete(id);
        if (!deletedDepreciation) {
            return res.status(404).json({ message: 'Depreciation record not found' });
        }
        res.status(200).json({ message: 'Depreciation record deleted successfully', depreciation: deletedDepreciation });
    } catch (error) {
        console.error('Error deleting depreciation record:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
